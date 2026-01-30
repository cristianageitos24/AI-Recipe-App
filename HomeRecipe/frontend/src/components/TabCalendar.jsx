import React, { useState, useRef, useEffect } from "react";
import "../styling/TabCalendar.css";
import "../styling/EventPopup.css";
import "../styling/EventSearchOptions.css";
import TabCalendarHeader from "./TabCalendarHeader";
import {
  handleDeleteMealDates,
  handleGetFavorites,
  handleGetFoldersBackend,
  handleGetMealDates,
  handlePostMealDates,
} from "./BackendMethods";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // a plugin!
import interactionPlugin from "@fullcalendar/interaction"; // needed for dayClick
import timeGridPlugin from "@fullcalendar/timegrid";

import { v4 as uuidv4 } from "uuid";

function TabCalendar() {
  const [events, setEvents] = useState([]);
  const [clickedEvent, setClickedEvent] = useState({});
  const [isEventClicked, setIsEventClicked] = useState(false);

  const [selectedFolder, setSelectedFolder] = useState("Any");
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [selectedSearchOption, setSelectedSearchOption] = useState("");
  const [folders, setFolders] = useState([]);
  const [isSearchOptionsVisible, setIsSearchOptionsVisible] = useState(false);

  const [inputText, setInputText] = useState("");
  const inputRef = useRef(null);

  const calendarRef = useRef(null);
  const [calendarKey, setCalendarKey] = useState(1);

  const generateUniqueId = () => {
    return uuidv4();
  };

  useEffect(() => {
    handleGetMealDates()
      .then((data) => {
        ////console.log(data);

        const newEvents = [];

        data.forEach((mealDate) => {
          mealDate.recipes.forEach((recipe) => {
            const newEvent = {
              className: "recipe-event-div",
              title: recipe.recipe_label,
              start: mealDate.date,
              eventID: recipe.eventID,
              recipeID: recipe.recipeID,
              imageURL: recipe.image_url,
              allDay: true,
              editable: true,
            };

            newEvents.push(newEvent);
          });
        });

        setEvents(newEvents);
      })
      .catch((error) => {
        console.error("Error getting favorites:", error);
      });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await handleGetFoldersBackend("ALL");
        const favoriteData = await handleGetFavorites();
        setFolders(["Any", ...data.folders]);

        if (selectedFolder === "Any") {
          let options = [];

          data.folders.forEach((folder) => {
            const newRecipes = data.results[folder].filter((recipe) => {
              return !options.some(
                (optionRecipe) => optionRecipe.recipeID === recipe.recipeID
              );
            });

            options = [...options, ...newRecipes];
          });

          favoriteData["Favorites"].forEach((favorite) => {
            if (
              !options.some((recipe) => recipe.recipeID === favorite.recipeID)
            ) {
              options.push(favorite);
            }
          });

          setFilteredOptions(options);
        } else {
          setFilteredOptions(data.results[selectedFolder]);
        }
      } catch (error) {
        console.error("Error fetching user data for calendar:", error);
      }
    };

    fetchData();
  }, [selectedFolder]);

  // this method serves to update the calendar when an event is added or removed, thats it
  const handleUpdateEvents = () => {
    setCalendarKey(calendarKey + 1);
    setCalendarKey(calendarKey - 1);
    if (calendarKey >= 100 || calendarKey < 0) {
      setCalendarKey(1);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Escape") {
      handleCancel();
    }
    if (event.key === "Enter") {
      handleConfirm();
    }
  };

  const handleConfirm = () => {
    if (clickedEvent.title !== "(New event)" || inputText !== "") {
      const eventIndex = events.findIndex(
        (event) => event.eventID === clickedEvent.eventID
      );

      if (eventIndex !== -1) {
        const updatedEvents = [...events];
        updatedEvents[eventIndex].title = inputText;
        updatedEvents[eventIndex].imageURL = selectedSearchOption.image_url;
        updatedEvents[eventIndex].recipeID = selectedSearchOption.recipeID;
        setEvents(updatedEvents);
      }

      handlePostMealDates({
        date: clickedEvent.start,
        recipeID: selectedSearchOption.recipeID,
        eventID: clickedEvent.eventID,
      });
      setIsEventClicked(false);
      setInputText("");
      handleUpdateEvents();
      //console.log(clickedEvent);

      // after the event is updated, we want to change the view to the day of the event
      // otherwise it will send user back to the current day
      setTimeout(() => {
        calendarRef.current
          .getApi()
          .changeView("dayGridMonth", clickedEvent.start);
      }, 1);
    } else {
      handleCancel();
    }
  };

  const handleCancel = () => {
    //console.log("cancel");

    const eventIndex = events.findIndex(
      (event) => event.eventID === clickedEvent.eventID
    );

    if (eventIndex !== -1 && clickedEvent.title === "(New event)") {
      const updatedEvents = [...events];
      updatedEvents.splice(eventIndex, 1);

      setEvents(updatedEvents);
    }

    setIsEventClicked(false);
    setInputText("");
  };

  const handleDateClick = (arg) => {
    //console.log(arg);
    const newEvent = {
      className: "recipe-event-div",
      title: "(New event)", // Replace with your desired title
      start: arg.dateStr,
      allDay: true, // Adjust as needed
      editable: true,
      eventID: generateUniqueId(),
      recipeID: "new",
      imageURL:
        "https://images.unsplash.com/photo-1485921325833-c519f76c4927?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHwyfHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
    };

    setEvents([...events, newEvent]);
    setIsEventClicked(true);
    setClickedEvent(newEvent);
  };

  const handleEventClick = (info) => {
    const eventIndex = events.findIndex(
      (event) => event.eventID === info.event._def.extendedProps.eventID
    );

    setClickedEvent(events[eventIndex]);
    setIsEventClicked(true);

    //console.log(events[eventIndex]);
    if (events[eventIndex].title !== "(New event)") {
      setInputText(events[eventIndex].title);
    } else {
      setInputText("");
    }
  };

  const handleEventDrop = (arg) => {
    const formatDate = (inputDate) => {
      const date = new Date(inputDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const eventID = arg.event._def.extendedProps.eventID;
    const eventDroppedDate = formatDate(arg.event._instance.range.end);

    const eventIndex = events.findIndex((event) => event.eventID === eventID);

    if (eventIndex !== -1) {
      const updatedEvents = [...events];
      updatedEvents[eventIndex].start = eventDroppedDate;

      handlePostMealDates({
        date: eventDroppedDate,
        recipeID: updatedEvents[eventIndex].recipeID,
        eventID: updatedEvents[eventIndex].eventID,
      });

      setEvents(updatedEvents);
    }
    setInputText("");
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleSelectFolderChange = (event) => {
    const selectedValue = event.target.value;
    setSelectedFolder(selectedValue);
    inputRef.current.focus();
  };

  const handleOptionClick = (option) => {
    setSelectedSearchOption(option);
    setInputText(option.recipe_label);
    setIsSearchOptionsVisible(false);

    inputRef.current.focus();
  };

  const handleSearchOptionsBlur = () => {
    setTimeout(() => {
      setIsSearchOptionsVisible(false);
    }, 200);
  };

  const handleTrashEvent = () => {
    //console.log("trash event");
    //console.log(clickedEvent);

    const eventIndex = events.findIndex(
      (event) => event.eventID === clickedEvent.eventID
    );
    const updatedEvents = [...events];
    updatedEvents.splice(eventIndex, 1);
    setEvents(updatedEvents);

    handleDeleteMealDates({ eventID: clickedEvent.eventID });
    setIsEventClicked(false);
    setInputText("");
  };

  const handleEventResize = (info) => {
    info.revert(); // This will revert the resize action
  };

  const EventTitleWithImage = ({ title, imageURL, id }) => (
    <>
      <div
        className={`tabcalendar-event-title-container ${
          isEventClicked && id === clickedEvent.eventID ? "active" : ""
        }`}
        style={
          isEventClicked && id === clickedEvent.eventID
            ? {
                position: "relative",
                zIndex: 1000,
              }
            : {}
        }
      >
        <img
          src={imageURL}
          alt="recipe food"
          style={title === "(New event)" ? { width: "0px" } : {}}
        />

        <p>{title}</p>
      </div>
      <div
        className="active-event-blob-div"
        style={
          isEventClicked && id === clickedEvent.eventID
            ? {
                display: "block",
              }
            : {
                display: "none",
              }
        }
      ></div>
    </>
  );
  return (
    <div className="right-side-panel" style={{ position: "relative" }}>
      {events && <TabCalendarHeader calendarEvents={events} />}

      <div className="calendar-app">
        <FullCalendar
          key={calendarKey}
          ref={calendarRef}
          height="100%"
          plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          weekends={true}
          headerToolbar={{
            left: "prev,next",
            center: "title",
            right: "today",
          }}
          editable={true}
          eventResize={handleEventResize} // Prevent resizing
          dateClick={handleDateClick}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          events={events}
          eventContent={(event) => (
            <EventTitleWithImage
              title={event.event._def.title}
              imageURL={event.event._def.extendedProps.imageURL}
              id={event.event._def.extendedProps.eventID}
            />
          )}
        />
      </div>

      {isEventClicked && (
        <div
          className="event-popup-overlay"
          onClick={handleCancel}
          onKeyDown={handleKeyPress}
        >
          <div
            className="calendar-event-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="event-popup-header">
              <h1 className="event-popup-title">Edit event</h1>
              <button className="delete-event-bttn" onClick={handleTrashEvent}>
                <svg
                  width="58"
                  height="64"
                  viewBox="0 0 58 64"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.5556 51.2C23.4101 51.2 24.2297 50.8629 24.834 50.2627C25.4383 49.6626 25.7778 48.8487 25.7778 48V28.8C25.7778 27.9513 25.4383 27.1374 24.834 26.5373C24.2297 25.9371 23.4101 25.6 22.5556 25.6C21.701 25.6 20.8814 25.9371 20.2771 26.5373C19.6728 27.1374 19.3333 27.9513 19.3333 28.8V48C19.3333 48.8487 19.6728 49.6626 20.2771 50.2627C20.8814 50.8629 21.701 51.2 22.5556 51.2ZM54.7778 12.8H41.8889V9.6C41.8889 7.05392 40.8704 4.61212 39.0576 2.81178C37.2447 1.01143 34.786 0 32.2222 0H25.7778C23.214 0 20.7553 1.01143 18.9424 2.81178C17.1296 4.61212 16.1111 7.05392 16.1111 9.6V12.8H3.22222C2.36764 12.8 1.54805 13.1371 0.943767 13.7373C0.339483 14.3374 0 15.1513 0 16C0 16.8487 0.339483 17.6626 0.943767 18.2627C1.54805 18.8629 2.36764 19.2 3.22222 19.2H6.44444V54.4C6.44444 56.9461 7.46289 59.3879 9.27575 61.1882C11.0886 62.9886 13.5474 64 16.1111 64H41.8889C44.4526 64 46.9114 62.9886 48.7243 61.1882C50.5371 59.3879 51.5556 56.9461 51.5556 54.4V19.2H54.7778C55.6324 19.2 56.452 18.8629 57.0562 18.2627C57.6605 17.6626 58 16.8487 58 16C58 15.1513 57.6605 14.3374 57.0562 13.7373C56.452 13.1371 55.6324 12.8 54.7778 12.8ZM22.5556 9.6C22.5556 8.75131 22.895 7.93738 23.4993 7.33726C24.1036 6.73714 24.9232 6.4 25.7778 6.4H32.2222C33.0768 6.4 33.8964 6.73714 34.5007 7.33726C35.105 7.93738 35.4444 8.75131 35.4444 9.6V12.8H22.5556V9.6ZM45.1111 54.4C45.1111 55.2487 44.7716 56.0626 44.1673 56.6627C43.5631 57.2629 42.7435 57.6 41.8889 57.6H16.1111C15.2565 57.6 14.4369 57.2629 13.8327 56.6627C13.2284 56.0626 12.8889 55.2487 12.8889 54.4V19.2H45.1111V54.4ZM35.4444 51.2C36.299 51.2 37.1186 50.8629 37.7229 50.2627C38.3272 49.6626 38.6667 48.8487 38.6667 48V28.8C38.6667 27.9513 38.3272 27.1374 37.7229 26.5373C37.1186 25.9371 36.299 25.6 35.4444 25.6C34.5899 25.6 33.7703 25.9371 33.166 26.5373C32.5617 27.1374 32.2222 27.9513 32.2222 28.8V48C32.2222 48.8487 32.5617 49.6626 33.166 50.2627C33.7703 50.8629 34.5899 51.2 35.4444 51.2Z"
                    fill="black"
                  />
                </svg>
              </button>
            </div>
            <div className="event-popup-labels">
              <select
                className="event-popup-choices"
                value={selectedFolder}
                onChange={handleSelectFolderChange}
              >
                {folders.map((folder, index) => (
                  <option key={index} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
              <div className="event-pop-up-search">
                <input
                  ref={inputRef}
                  className="event-popup-input"
                  style={
                    isSearchOptionsVisible
                      ? { borderRadius: "0px 10px 0px 0px" }
                      : {}
                  }
                  type="text"
                  placeholder={"Search your recipes..."}
                  value={inputText}
                  onChange={handleInputChange}
                  onFocus={() => setIsSearchOptionsVisible(true)}
                  onBlur={() => handleSearchOptionsBlur()}
                  autoFocus
                />

                {isSearchOptionsVisible && filteredOptions.length > 0 && (
                  <div className="event-search-options">
                    <ul className="unordered-search-options-list">
                      {filteredOptions
                        .filter((option) =>
                          option.recipe_label
                            .toLowerCase()
                            .includes(inputText.toLowerCase())
                        )
                        .map((option, index) => (
                          <li
                            onClick={() => handleOptionClick(option)}
                            key={index}
                          >
                            {option.recipe_label}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="event-popup-bttns">
              <button className="cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button
                className="confirm"
                onClick={() => handleConfirm(clickedEvent.eventID)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TabCalendar;
