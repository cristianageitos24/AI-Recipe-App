import React, { useEffect, useState } from "react";
import "../styling/TabCalendarHeader.css";
import { ReactComponent as EmptyCalendarSVG } from "../images/dashboard/empty-calendar.svg";
import CalendarRecipeCard from "./CalendarRecipeCard";
import { handleGetRecipe } from "./BackendMethods";
import { motion } from "framer-motion";

function TabCalendarHeader({ calendarEvents }) {
  const [todayDate, setTodayDate] = useState("");
  const [todayMeals, setTodayMeals] = useState([]);
  const [upcomingMeals, setUpcomingMeals] = useState([]);

  const [recipes, setRecipes] = useState([]);

  /* GETS ALL RECIPES ASSOCIATED TO USER */
  useEffect(() => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    const today = `${year}-${month}-${day}`;

    // console.log("todayDate", today);
    setTodayDate(today);

    handleGetRecipe().then((data) => {
      setRecipes(data);
    });
  }, []);

  /* GETS EVENTS AND RETURNS TODAYS AND UPCOMING */
  useEffect(() => {
    const findRecipes = (data) => {
      const sortedData = [...data].sort(
        (a, b) => new Date(a.start) - new Date(b.start)
      );

      const todayMeals = sortedData.filter((item) => {
        return item.start === todayDate;
      });

      const upcomingDates = sortedData.filter((item) => item.start > todayDate);
      const groupedDates = upcomingDates.reduce((acc, item) => {
        const date = item.start;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(item);
        return acc;
      }, {});

      const dateArrays = Object.values(groupedDates);
      const firstMeals = dateArrays[0];
      const secondMeals = dateArrays[1];

      setTodayMeals(todayMeals);
      setUpcomingMeals([firstMeals, secondMeals]);
    };

    if (calendarEvents.length > 0) {
      findRecipes(calendarEvents);
    }
  }, [calendarEvents, todayDate]);

  const formatDate = (inputDate) => {
    const date = new Date(inputDate);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
    }).format(date);
    return formattedDate;
  };

  const likedRecipesMotionContainer = {
    hidden: { opacity: 1, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.2,
      },
    },
  };

  const likedRecipesMotionItem = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  /**
   * Checks if all calendar events are before today's date.
   * @returns {boolean} True if all events are before today, false otherwise.
   */
  const areAllEventsBeforeToday = () => {
    return calendarEvents.every((event) => event.start < todayDate);
  };

  /**
   * Checks if the events are good or just drafts. Checks if today events are drafts and upcoming events are not, or vice versa.
   *
   * @returns {boolean} Returns true if the events are good, false if they are just drafts.
   */
  const areGoodEventsJustDrafts = () => {
    const isDraft = (meals) =>
      meals && meals.length === 1 && meals[0].title === "(New event)"; // Check if only the first is a draft
    const isNotDraft = (meals) =>
      meals && meals.length > 0 && meals[0].title !== "(New event)";

    if (
      (isDraft(upcomingMeals[0]) && isNotDraft(upcomingMeals[1])) || // Check if upcoming events are drafts and the next upcoming is not
      (isDraft(todayMeals) && isNotDraft(upcomingMeals[0])) || // Check if first today events are drafts and the upcoming are not
      (isNotDraft(todayMeals) && isDraft(upcomingMeals[0])) // Check if today events are not drafts and the first upcoming events are
    ) {
      return false;
    }

    if (isDraft(todayMeals) || isDraft(upcomingMeals[0])) {
      // Check if either today events or upcoming events are drafts
      return true;
    }

    return false;
  };

  /* When user clicks to make new event, ignore it until confirmed, also ignore if its before today*/
  return (
    <>
      {calendarEvents.length === 0 ||
      (calendarEvents.length > 0 &&
        (areAllEventsBeforeToday() || areGoodEventsJustDrafts())) ? (
        <section className="emptycalendar">
          <h1 className="tabcalendar-start-title">
            Embark on your culinary adventure by clicking on any day on the
            calendar!
          </h1>
          <EmptyCalendarSVG className="tabcalendar-empty-calendar-svg" />
          <h1 className="tabcalendar-start-subtitle">
            Effortlessly organize and select recipes, and your upcoming culinary
            delights for today or the future will show right here.
          </h1>
        </section>
      ) : (
        <section>
          <h1 className="calendar-upcoming-title">Upcoming Dishes</h1>
          {todayMeals &&
            todayMeals.length === 0 &&
            recipes["recipes"] &&
            upcomingMeals[0] &&
            upcomingMeals[0].length > 0 && (
              <div className="calendar-upcoming-events-container">
                <div className="calendar-event-slide">
                  <div className="calendar-event-date">
                    <h1 className="calendar-upcoming-day">
                      {upcomingMeals[0][0].start.slice(-2)}
                    </h1>
                    <h1 className="calendar-upcoming-month">
                      {formatDate(upcomingMeals[0][0].start).toUpperCase()}
                    </h1>
                    <hr className="calendar-upcoming-hr" />
                  </div>

                  <div className="cards-container">
                    <div className="scrollable-wrapper">
                      <motion.div
                        variants={likedRecipesMotionContainer}
                        initial="hidden"
                        animate="visible"
                      >
                        <ul className="upcoming-meals-container">
                          {upcomingMeals[0].map((meal, index) => {
                            const recipeData = recipes["recipes"].find(
                              (item) => item.recipeID === meal.recipeID
                            );
                            return (
                              <motion.div
                                key={index}
                                variants={likedRecipesMotionItem}
                              >
                                <CalendarRecipeCard
                                  key={index}
                                  recipe={recipeData}
                                />
                              </motion.div>
                            );
                          })}
                        </ul>
                      </motion.div>
                    </div>
                  </div>
                </div>
                {upcomingMeals[1] && upcomingMeals[1].length > 0 && (
                  <div className="calendar-event-slide">
                    <div className="calendar-event-date">
                      <h1 className="calendar-upcoming-day">
                        {upcomingMeals[1][0].start.slice(-2)}
                      </h1>
                      <h1 className="calendar-upcoming-month">
                        {formatDate(upcomingMeals[1][0].start).toUpperCase()}
                      </h1>
                      <hr className="calendar-upcoming-hr" />
                    </div>

                    <div className="cards-container">
                      <div className="scrollable-wrapper">
                        <motion.div
                          variants={likedRecipesMotionContainer}
                          initial="hidden"
                          animate="visible"
                        >
                          <ul className="upcoming-meals-container">
                            {upcomingMeals[1].map((meal, index) => {
                              const recipeData = recipes["recipes"].find(
                                (item) => item.recipeID === meal.recipeID
                              );
                              return (
                                <motion.div
                                  key={index}
                                  variants={likedRecipesMotionItem}
                                >
                                  <CalendarRecipeCard
                                    key={index}
                                    recipe={recipeData}
                                  />
                                </motion.div>
                              );
                            })}
                          </ul>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          {todayMeals && todayMeals.length > 0 && recipes["recipes"] && (
            <div className="calendar-upcoming-events-container">
              <div className="calendar-event-slide">
                <div className="calendar-event-date">
                  <h1 className="calendar-today-subhead">TODAY</h1>
                  <h1 className="calendar-upcoming-day">
                    {todayDate.slice(-2)}
                  </h1>
                  <h1 className="calendar-upcoming-month">
                    {formatDate(todayDate).toUpperCase()}
                  </h1>
                  <hr className="calendar-upcoming-hr" />
                </div>

                <div className="cards-container">
                  <div className="scrollable-wrapper">
                    <motion.div
                      variants={likedRecipesMotionContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      <ul className="upcoming-meals-container">
                        {todayMeals.map((meal, index) => {
                          const recipeData = recipes["recipes"].find(
                            (item) => item.recipeID === meal.recipeID
                          );
                          return (
                            <motion.div
                              key={index}
                              variants={likedRecipesMotionItem}
                            >
                              <CalendarRecipeCard
                                key={index}
                                recipe={recipeData}
                              />
                            </motion.div>
                          );
                        })}
                      </ul>
                    </motion.div>
                  </div>
                </div>
              </div>
              {upcomingMeals[0] && upcomingMeals[0].length > 0 && (
                <div className="calendar-event-slide">
                  <div className="calendar-event-date">
                    <h1 className="calendar-upcoming-day">
                      {upcomingMeals[0][0].start.slice(-2)}
                    </h1>
                    <h1 className="calendar-upcoming-month">
                      {formatDate(upcomingMeals[0][0].start).toUpperCase()}
                    </h1>
                    <hr className="calendar-upcoming-hr" />
                  </div>

                  <div className="cards-container">
                    <div className="scrollable-wrapper">
                      <motion.div
                        variants={likedRecipesMotionContainer}
                        initial="hidden"
                        animate="visible"
                      >
                        <ul className="upcoming-meals-container">
                          {upcomingMeals[0].map((meal, index) => {
                            const recipeData = recipes["recipes"].find(
                              (item) => item.recipeID === meal.recipeID
                            );
                            return (
                              <motion.div
                                key={index}
                                variants={likedRecipesMotionItem}
                              >
                                <CalendarRecipeCard
                                  key={index}
                                  recipe={recipeData}
                                />
                              </motion.div>
                            );
                          })}
                        </ul>
                      </motion.div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default TabCalendarHeader;
