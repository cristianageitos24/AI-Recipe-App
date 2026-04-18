"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import { v4 as uuidv4 } from "uuid";
import { getMealDates, createOrUpdateMealDate, deleteMealDate } from "@/app/actions/meal-dates";
import { getGroceryTrips, deleteGroceryTrip } from "@/app/actions/grocery-trips";
import { getCalendarBootstrap } from "@/app/actions/dashboard";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabCalendar.css";
import "@/app/styling/TabCalendarHeader.css";
import "@/app/styling/CalendarRecipeCard.css";
import "@/app/styling/EventPopup.css";
import "@/app/styling/EventSearchOptions.css";

type CalendarEvent = {
  className: string;
  title: string;
  start: string;
  eventID: string;
  recipeID: string;
  imageURL: string;
  allDay: boolean;
  editable: boolean;
  eventType?: "recipe" | "grocery";
  calories?: number | null;
  cuisineType?: string | null;
  mealType?: string | null;
  timeInMinutes?: number | null;
};

function capitalizeForCard(input?: string | null): string {
  if (!input) return "";
  return input
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");
}

function mapEvents(
  mealDates: Array<{ date: string; recipes: Array<RecipeRow & { eventID?: string }> }>,
  groceryTrips: Array<{ id: string; planned_date: string }>
): CalendarEvent[] {
  const mapped: CalendarEvent[] = [];
  for (const mealDate of mealDates) {
    for (const recipe of mealDate.recipes) {
      mapped.push({
        className: "recipe-event-div",
        title: recipe.recipe_label,
        start: mealDate.date,
        eventID: recipe.eventID ?? "",
        recipeID: recipe.recipe_id,
        imageURL: recipe.image_url ?? "",
        allDay: true,
        editable: true,
        eventType: "recipe",
        calories: recipe.calories,
        cuisineType: recipe.cuisine_type,
        mealType: recipe.meal_type,
        timeInMinutes: recipe.time_in_minutes,
      });
    }
  }
  for (const trip of groceryTrips) {
    mapped.push({
      className: "grocery-trip-event",
      title: "Grocery trip",
      start: trip.planned_date,
      eventID: trip.id,
      recipeID: "",
      imageURL: "",
      allDay: true,
      editable: false,
      eventType: "grocery",
      calories: null,
      cuisineType: null,
      mealType: null,
      timeInMinutes: null,
    });
  }
  return mapped;
}

function getOptionsForFolder(
  selectedFolder: string,
  folderList: string[],
  folderResults: Record<string, RecipeRow[]>,
  favorites: RecipeRow[]
): RecipeRow[] {
  if (selectedFolder !== "Any") {
    return folderResults[selectedFolder] ?? [];
  }
  const seen = new Set<string>();
  const options: RecipeRow[] = [];
  for (const folder of folderList) {
    for (const recipe of folderResults[folder] ?? []) {
      if (seen.has(recipe.recipe_id)) continue;
      seen.add(recipe.recipe_id);
      options.push(recipe);
    }
  }
  for (const recipe of favorites) {
    if (seen.has(recipe.recipe_id)) continue;
    seen.add(recipe.recipe_id);
    options.push(recipe);
  }
  return options;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clickedEvent, setClickedEvent] = useState<CalendarEvent | null>(null);
  const [isEventClicked, setIsEventClicked] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("Any");
  const [filteredOptions, setFilteredOptions] = useState<RecipeRow[]>([]);
  const [selectedSearchOption, setSelectedSearchOption] = useState<RecipeRow | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [folderResults, setFolderResults] = useState<Record<string, RecipeRow[]>>({});
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [isSearchOptionsVisible, setIsSearchOptionsVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarKey, setCalendarKey] = useState(1);
  const loadEvents = useCallback(async () => {
    const [mealRes, tripsRes] = await Promise.all([getMealDates(), getGroceryTrips()]);
    setEvents(
      mapEvents(
        (mealRes.data ?? []) as Array<{ date: string; recipes: Array<RecipeRow & { eventID?: string }> }>,
        (tripsRes.data ?? []) as Array<{ id: string; planned_date: string }>
      )
    );
  }, []);

  useEffect(() => {
    getCalendarBootstrap().then((res) => {
      if (!res.data) return;
      const folderList = res.data.folders;
      const results = res.data.results;
      const favoritesData = res.data.favorites;
      setEvents(
        mapEvents(
          res.data.mealDates as Array<{ date: string; recipes: Array<RecipeRow & { eventID?: string }> }>,
          res.data.groceryTrips as Array<{ id: string; planned_date: string }>
        )
      );
      setFolders(["Any", ...folderList]);
      setFolderResults(results);
      setFavorites(favoritesData);
      setFilteredOptions(getOptionsForFolder("Any", folderList, results, favoritesData));
    });
  }, []);

  useEffect(() => {
    const folderList = folders.filter((f) => f !== "Any");
    setFilteredOptions(getOptionsForFolder(selectedFolder, folderList, folderResults, favorites));
  }, [favorites, folderResults, folders, selectedFolder]);

  function handleUpdateEvents() {
    setCalendarKey((k) => (k >= 100 || k < 0 ? 1 : k + 1));
    loadEvents();
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") handleConfirm();
  }

  async function handleConfirm() {
    if (!clickedEvent) return;
    if (clickedEvent.title === "(New event)" && !selectedSearchOption) {
      handleCancel();
      return;
    }
    const recipeID = selectedSearchOption?.recipe_id ?? clickedEvent.recipeID;
    await createOrUpdateMealDate({
      date: clickedEvent.start,
      recipeID,
      eventID: clickedEvent.eventID,
    });
    if (selectedSearchOption) {
      const idx = events.findIndex((e) => e.eventID === clickedEvent.eventID);
      if (idx !== -1) {
        const next = [...events];
        next[idx] = {
          ...next[idx],
          title: selectedSearchOption.recipe_label,
          recipeID: selectedSearchOption.recipe_id,
          imageURL: selectedSearchOption.image_url ?? "",
          calories: selectedSearchOption.calories,
          cuisineType: selectedSearchOption.cuisine_type,
          mealType: selectedSearchOption.meal_type,
          timeInMinutes: selectedSearchOption.time_in_minutes,
        };
        setEvents(next);
      }
    }
    setIsEventClicked(false);
    setInputText("");
    setSelectedSearchOption(null);
    handleUpdateEvents();
    setTimeout(() => {
      calendarRef.current?.getApi().changeView("dayGridMonth", clickedEvent.start);
    }, 1);
  }

  function handleCancel() {
    if (clickedEvent?.title === "(New event)") {
      setEvents((prev) => prev.filter((e) => e.eventID !== clickedEvent.eventID));
    }
    setIsEventClicked(false);
    setInputText("");
    setSelectedSearchOption(null);
  }

  function handleDateClick(arg: { dateStr: string }) {
    const newEvent: CalendarEvent = {
      className: "recipe-event-div",
      title: "(New event)",
      start: arg.dateStr,
      allDay: true,
      editable: true,
      eventID: uuidv4(),
      recipeID: "new",
      imageURL: "https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=400",
      eventType: "recipe",
      calories: 0,
      cuisineType: "",
      mealType: "",
      timeInMinutes: 0,
    };
    setEvents((prev) => [...prev, newEvent]);
    setClickedEvent(newEvent);
    setIsEventClicked(true);
  }

  function handleEventClick(info: EventClickArg) {
    const eventID = (info.event._def.extendedProps as { eventID?: string }).eventID ?? "";
    const ev = events.find((e) => e.eventID === eventID);
    if (ev) {
      setClickedEvent(ev);
      setIsEventClicked(true);
      setInputText(ev.title === "(New event)" ? "" : ev.title);
    }
  }

  async function handleEventDrop(arg: EventDropArg) {
    const eventID = (arg.event._def.extendedProps as { eventID?: string }).eventID ?? "";
    const d = arg.event._instance?.range?.end;
    if (!d) return;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ev = events.find((e) => e.eventID === eventID);
    if (ev) {
      if (ev.recipeID !== "new") {
        await createOrUpdateMealDate({ date: dateStr, recipeID: ev.recipeID, eventID });
      }
      setEvents((prev) =>
        prev.map((e) => (e.eventID === eventID ? { ...e, start: dateStr } : e))
      );
    }
  }

  async function handleTrashEvent() {
    if (!clickedEvent) return;
    if (clickedEvent.eventType === "grocery") {
      await deleteGroceryTrip(clickedEvent.eventID);
    } else {
      await deleteMealDate(clickedEvent.eventID);
    }
    setEvents((prev) => prev.filter((e) => e.eventID !== clickedEvent.eventID));
    setIsEventClicked(false);
    setInputText("");
  }

  function handleEventResize() {
    // no-op
  }

  const visibleOptions = filteredOptions.filter((r) =>
    r.recipe_label.toLowerCase().includes(inputText.toLowerCase())
  );
  const upcomingMeals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter((event) => event.eventType !== "grocery" && event.title !== "(New event)")
      .map((event) => ({
        ...event,
        dateObj: new Date(`${event.start}T12:00:00`),
      }))
      .filter((event) => !Number.isNaN(event.dateObj.getTime()) && event.dateObj >= today)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .slice(0, 2);
  }, [events]);
  const upcomingByDate = useMemo(() => {
    const grouped: Record<string, Array<(typeof upcomingMeals)[number]>> = {};
    for (const event of upcomingMeals) {
      if (!grouped[event.start]) grouped[event.start] = [];
      grouped[event.start].push(event);
    }
    return grouped;
  }, [upcomingMeals]);

  return (
    <div className="main-panel" style={{ position: "relative" }}>
      {upcomingMeals.length === 0 ? (
        <div className="emptycalendar">
          <p className="tabcalendar-start-title">
            Embark on your culinary adventure by clicking on any day on the calendar!
          </p>
          <img
            className="tabcalendar-empty-calendar-svg"
            src="/images/dashboard/empty-calendar.svg"
            alt="No upcoming meals yet"
          />
          <p className="tabcalendar-start-subtitle">
            Effortlessly organize and select recipes, and your upcoming culinary delights will show right here.
          </p>
        </div>
      ) : (
        <>
          <h2 className="calendar-upcoming-title">Upcoming Dishes</h2>
          <div className="calendar-upcoming-events-container">
            {Object.entries(upcomingByDate).map(([dateKey, dateEvents]) => {
              const d = new Date(`${dateKey}T12:00:00`);
              const day = d.toLocaleDateString(undefined, { day: "2-digit" });
              const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
              return (
                <div key={dateKey} className="calendar-event-slide">
                  <div className="calendar-event-date">
                    <p className="calendar-upcoming-day">{day}</p>
                    <p className="calendar-upcoming-month">{month}</p>
                    <hr className="calendar-upcoming-hr" />
                  </div>
                  <div className="cards-container">
                    <div className="scrollable-wrapper">
                      <ul className="upcoming-meals-container">
                        {dateEvents.map((event) => {
                          const minutes = event.timeInMinutes && event.timeInMinutes > 0 ? event.timeInMinutes : 1;
                          const minutesTone = minutes < 10 ? "fast" : minutes > 30 ? "slow" : "medium";
                          return (
                            <li key={event.eventID}>
                              <article className="calendar-upcoming-recipe-card">
                                <div
                                  className="calendar-upcoming-recipe-image"
                                  style={{
                                    backgroundImage: `url(${event.imageURL || "/images/recipe-placeholder.png"})`,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="image-hover-bttn"
                                    onClick={() => {
                                      setClickedEvent(event);
                                      setIsEventClicked(true);
                                      setInputText(event.title === "(New event)" ? "" : event.title);
                                    }}
                                  >
                                    <p>Open Recipe</p>
                                  </button>
                                </div>
                                <div className="calendar-upcoming-recipe-content">
                                  <h1>{event.title}</h1>
                                  <div className="calendar-upcoming-recipe-subcontent">
                                    <p>{capitalizeForCard(event.cuisineType)}</p>
                                    <p>{capitalizeForCard(event.mealType)}</p>
                                  </div>
                                  <div className="small-labels">
                                    <p>
                                      <span>{Math.round(event.calories ?? 0)}</span> calories
                                    </p>
                                    <p className={`calendar-card-minutes calendar-card-minutes--${minutesTone}`}>
                                      {minutes} {minutes === 1 ? "minute" : "minutes"}
                                    </p>
                                  </div>
                                </div>
                              </article>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <div className="calendar-app">
        <FullCalendar
          key={calendarKey}
          ref={calendarRef}
          height="100%"
          plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          weekends
          headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
          editable
          eventResize={handleEventResize}
          dateClick={handleDateClick}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          events={events.map((e) => ({
            title: e.title,
            start: e.start,
            allDay: e.allDay,
            editable: e.editable,
            className: e.className,
            extendedProps: {
              eventID: e.eventID,
              recipeID: e.recipeID,
              imageURL: e.imageURL,
              eventType: e.eventType ?? "recipe",
            },
          }))}
          eventContent={(eventInfo) => {
            const props = eventInfo.event._def.extendedProps as {
              eventID?: string;
              imageURL?: string;
              eventType?: "recipe" | "grocery";
            };
            const isGrocery = props.eventType === "grocery";
            const isActive =
              isEventClicked && clickedEvent?.eventID === props.eventID;
            return (
              <div
                className={`tabcalendar-event-title-container ${
                  isGrocery ? "tabcalendar-grocery-event" : ""
                } ${isActive ? "active" : ""}`}
              >
                {isGrocery ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ flexShrink: 0 }}
                    aria-hidden
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                ) : (
                  <img
                    src={props.imageURL || "/images/recipe-placeholder.png"}
                    alt=""
                    style={
                      eventInfo.event._def.title === "(New event)"
                        ? { width: 0 }
                        : {}
                    }
                  />
                )}
                <p>{eventInfo.event._def.title}</p>
              </div>
            );
          }}
        />
      </div>
      {isEventClicked && clickedEvent && (
        <div className="event-popup-overlay" onClick={handleCancel} onKeyDown={handleKeyPress}>
          <div className="calendar-event-popup" onClick={(e) => e.stopPropagation()}>
            <div className="event-popup-header">
              <h1 className="event-popup-title">
                {clickedEvent.eventType === "grocery" ? "Grocery trip" : "Edit event"}
              </h1>
              <button type="button" className="delete-event-bttn" onClick={handleTrashEvent} aria-label="Delete event">
                <svg width="58" height="64" viewBox="0 0 58 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.5556 51.2C23.4101 51.2 24.2297 50.8629 24.834 50.2627C25.4383 49.6626 25.7778 48.8487 25.7778 48V28.8C25.7778 27.9513 25.4383 27.1374 24.834 26.5373C24.2297 25.9371 23.4101 25.6 22.5556 25.6C21.701 25.6 20.8814 25.9371 20.2771 26.5373C19.6728 27.1374 19.3333 27.9513 19.3333 28.8V48C19.3333 48.8487 19.6728 49.6626 20.2771 50.2627C20.8814 50.8629 21.701 51.2 22.5556 51.2Z" fill="var(--color-fg)" />
                </svg>
              </button>
            </div>
            {clickedEvent.eventType === "grocery" ? (
              <p className="event-popup-empty-state-text" style={{ marginBottom: "var(--space-4)" }}>
                Planned grocery trip on {new Date(clickedEvent.start + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            ) : filteredOptions.length === 0 ? (
              <>
                <div className="event-popup-empty-state">
                  <p className="event-popup-empty-state-text">
                    You don&apos;t have any saved recipes yet. Save recipes from{" "}
                    <Link href="/dashboard/home" className="event-popup-empty-state-link">
                      Home
                    </Link>{" "}
                    (search and like or save to a cookbook), then come back here to assign them to a date.
                  </p>
                </div>
              </>
            ) : null}
            {clickedEvent.eventType !== "grocery" && filteredOptions.length > 0 && (
              <div className="event-popup-labels">
                <select
                  className="event-popup-choices"
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <div className="event-pop-up-search">
                  <input
                    ref={inputRef}
                    className="event-popup-input"
                    style={isSearchOptionsVisible ? { borderRadius: "0px 10px 0px 0px" } : {}}
                    type="text"
                    placeholder="Search your recipes..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onFocus={() => setIsSearchOptionsVisible(true)}
                    onBlur={() => setTimeout(() => setIsSearchOptionsVisible(false), 200)}
                    autoFocus
                  />
                  {isSearchOptionsVisible && visibleOptions.length > 0 && (
                    <div className="event-search-options">
                      <ul className="unordered-search-options-list">
                        {visibleOptions.map((option) => (
                          <li
                            key={option.id}
                            onClick={() => {
                              setSelectedSearchOption(option);
                              setInputText(option.recipe_label);
                              setIsSearchOptionsVisible(false);
                            }}
                          >
                            {option.recipe_label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {isSearchOptionsVisible && visibleOptions.length === 0 && filteredOptions.length > 0 && (
                    <div className="event-search-options event-search-options-empty">
                      <p className="event-popup-no-match">No matching recipes</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="event-popup-bttns">
              <button type="button" className="cancel" onClick={handleCancel}>
                {clickedEvent.eventType === "grocery" ? "Close" : "Cancel"}
              </button>
              {clickedEvent.eventType !== "grocery" && (
                <button type="button" className="confirm" onClick={handleConfirm}>
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
