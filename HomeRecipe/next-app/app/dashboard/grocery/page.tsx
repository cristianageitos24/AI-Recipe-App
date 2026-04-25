"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { AnimatePresence, motion } from "framer-motion";
import {
  getGroceryItems,
  addGroceryItem,
  toggleGroceryItemChecked,
  clearCheckedGroceryItems,
  checkAllGroceryItems,
  uncheckAllGroceryItems,
} from "@/app/actions/grocery-items";
import { createGroceryTrip } from "@/app/actions/grocery-trips";
import "@/app/styling/GroceryList.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

type GroceryItem = {
  id: string;
  item_text: string;
  checked: boolean;
  created_at: string;
};

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateForPreview(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const QUICK_PICK_OPTIONS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 2 days", days: 2 },
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
] as const;

const GROCERY_CATEGORIES = [
  {
    key: "produce",
    label: "Produce",
    keywords: [
      "apple",
      "avocado",
      "banana",
      "bean",
      "broccoli",
      "carrot",
      "cilantro",
      "garlic",
      "jalapeño",
      "jalapeno",
      "lettuce",
      "lime",
      "onion",
      "pepper",
      "potato",
      "spinach",
      "tomato",
    ],
  },
  {
    key: "dairy",
    label: "Dairy",
    keywords: ["butter", "cheese", "cream", "feta", "milk", "mozzarella", "parmesan", "yogurt"],
  },
  {
    key: "pantry",
    label: "Pantry",
    keywords: ["beans", "bread", "flour", "grain", "pasta", "rice", "salt", "sugar", "vinegar"],
  },
  {
    key: "condiments",
    label: "Condiments",
    keywords: ["dressing", "honey", "mayo", "mustard", "oil", "salsa", "sauce", "soy"],
  },
] as const;

type GroceryCategoryKey = (typeof GROCERY_CATEGORIES)[number]["key"];

function getItemCategory(itemText: string): GroceryCategoryKey {
  const normalized = itemText.toLowerCase();
  return (
    GROCERY_CATEGORIES.find((category) =>
      category.keywords.some((keyword) => normalized.includes(keyword))
    )?.key ?? "pantry"
  );
}

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<GroceryCategoryKey>("produce");
  const [activeCategory, setActiveCategory] = useState<GroceryCategoryKey | "all">("all");
  const [pendingCheckedIds, setPendingCheckedIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => formatDateForInput(new Date()));
  const [calendarMode, setCalendarMode] = useState<"date" | "relative">("date");
  const [relativeDays, setRelativeDays] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const summarySlotRef = useRef<HTMLDivElement | null>(null);
  const summaryCardRef = useRef<HTMLElement | null>(null);
  const [summaryPin, setSummaryPin] = useState({
    height: 0,
    isPinned: false,
    left: 0,
    width: 0,
  });

  const loadItems = useCallback(async () => {
    const res = await getGroceryItems();
    if (res.data) setItems(res.data as GroceryItem[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    getGroceryItems().then((res) => {
      if (!isCurrent) return;
      if (res.data) setItems(res.data as GroceryItem[]);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const dashboardScroller = document.querySelector(".dashboard-main");

    function updateSummaryPin() {
      const slot = summarySlotRef.current;
      const card = summaryCardRef.current;
      if (!slot || !card || window.innerWidth <= 1180) {
        setSummaryPin((prev) =>
          prev.isPinned ? { height: 0, isPinned: false, left: 0, width: 0 } : prev
        );
        return;
      }

      const slotRect = slot.getBoundingClientRect();
      const cardHeight = card.offsetHeight;
      const shouldPin = slotRect.top <= 20;
      const next = {
        height: cardHeight,
        isPinned: shouldPin,
        left: slotRect.left,
        width: slotRect.width,
      };

      setSummaryPin((prev) =>
        prev.height === next.height &&
        prev.isPinned === next.isPinned &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5
          ? prev
          : next
      );
    }

    updateSummaryPin();
    window.addEventListener("scroll", updateSummaryPin, { passive: true });
    window.addEventListener("resize", updateSummaryPin);
    dashboardScroller?.addEventListener("scroll", updateSummaryPin, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateSummaryPin);
      window.removeEventListener("resize", updateSummaryPin);
      dashboardScroller?.removeEventListener("scroll", updateSummaryPin);
    };
  }, [items.length]);

  async function handleAdd() {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText("");
    const res = await addGroceryItem(trimmed);
    if (res.error) {
      setFeedback(res.error);
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    if (res.duplicate) {
      setFeedback("Already in list");
      setTimeout(() => setFeedback(null), 2000);
      return;
    }
    await loadItems();
  }

  async function handleToggle(id: string) {
    const item = items.find((i) => i.id === id);
    const shouldShowCheckFirst = item && !item.checked;

    if (shouldShowCheckFirst) {
      setPendingCheckedIds((prev) => new Set(prev).add(id));
      await Promise.all([
        toggleGroceryItemChecked(id),
        new Promise((resolve) => setTimeout(resolve, 120)),
      ]);
    } else {
      await toggleGroceryItemChecked(id);
    }

    setPendingCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  async function handleClearChecked() {
    const checkedCount = items.filter((i) => i.checked).length;
    if (checkedCount === 0) return;
    await clearCheckedGroceryItems();
    setItems((prev) => prev.filter((i) => !i.checked));
  }

  async function handleToggleAll() {
    if (items.length === 0) return;
    const allChecked = items.every((i) => i.checked);
    const res = allChecked ? await uncheckAllGroceryItems() : await checkAllGroceryItems();
    if (res.error) {
      setFeedback(res.error);
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setItems((prev) => prev.map((i) => ({ ...i, checked: !allChecked })));
  }

  function getPlannedDate(): string | null {
    if (calendarMode === "date") {
      return calendarDate || null;
    }
    const d = new Date();
    d.setDate(d.getDate() + relativeDays);
    return formatDateForInput(d);
  }

  async function handleAddToCalendar() {
    const date = getPlannedDate();
    if (!date) return;
    const res = await createGroceryTrip(date);
    if (res.error) {
      setFeedback(res.error);
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setIsCalendarOpen(false);
    setFeedback("Added to calendar! ");
    setTimeout(() => setFeedback(null), 2000);
  }

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);
  const hasChecked = checkedItems.length > 0;
  const allChecked = items.length > 0 && uncheckedItems.length === 0;
  const categoryCounts = GROCERY_CATEGORIES.map((category) => {
    const categoryItems = items.filter((item) => getItemCategory(item.item_text) === category.key);
    return {
      ...category,
      checked: categoryItems.filter((item) => item.checked).length,
      total: categoryItems.length,
    };
  });
  const visibleUncheckedItems =
    activeCategory === "all"
      ? uncheckedItems
      : uncheckedItems.filter((item) => getItemCategory(item.item_text) === activeCategory);
  const groupedUncheckedItems = GROCERY_CATEGORIES.map((category) => ({
    ...category,
    items: visibleUncheckedItems.filter((item) => getItemCategory(item.item_text) === category.key),
  })).filter((category) => category.items.length > 0);
  const progress = items.length === 0 ? 0 : Math.round((checkedItems.length / items.length) * 100);

  return (
    <div className="main-panel">
      <div className="grocery-page">
        <header className="grocery-page-header">
          <span className="grocery-page-title-icon">
            <Image
              src="/images/dashboard/groceryicon.svg"
              alt=""
              width={21}
              height={21}
            />
          </span>
          <div>
            <h1
              style={{
                fontFamily: playfairDisplay.style.fontFamily,
                fontWeight: 800,
                fontOpticalSizing: "auto",
              }}
            >
              Grocery List
            </h1>
            <p>Keep track of everything you need. Check off as you shop.</p>
          </div>
        </header>
        <div className="grocery-layout">
          <section className="grocery-list-card" aria-label="Grocery checklist">
            <div className="grocery-add-row">
              <div className="grocery-add-control">
                <span className="grocery-add-plus" aria-hidden>
                  +
                </span>
                <input
                  type="text"
                  className="grocery-add-input"
                  placeholder="Add an item..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <select
                  className="grocery-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as GroceryCategoryKey)}
                  aria-label="Choose category"
                >
                  {GROCERY_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="grocery-add-btn" onClick={handleAdd}>
                Add
              </button>
            </div>
            {feedback && (
              <p role="status" className="grocery-feedback">
                {feedback}
                {feedback.startsWith("Added") && (
                  <Link href="/dashboard/calendar" className="grocery-feedback-link">
                    View calendar
                  </Link>
                )}
              </p>
            )}
            <div className="grocery-filter-bar">
              <button
                type="button"
                className={`grocery-filter-chip ${activeCategory === "all" ? "active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                All <span>{items.length}</span>
              </button>
              {categoryCounts.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`grocery-filter-chip ${activeCategory === category.key ? "active" : ""}`}
                  onClick={() => setActiveCategory(category.key)}
                >
                  {category.label} <span>{category.total}</span>
                </button>
              ))}
            </div>
            <div className="grocery-toolbar">
              <label className={`grocery-check-all-row ${items.length === 0 ? "disabled" : ""}`}>
                <input
                  type="checkbox"
                  className="grocery-check-all-checkbox"
                  checked={allChecked}
                  onChange={handleToggleAll}
                  disabled={items.length === 0}
                  aria-label={allChecked ? "Uncheck all grocery items" : "Check all grocery items"}
                />
                <span>{allChecked ? "Uncheck all" : "Select all"}</span>
              </label>
              <button
                type="button"
                className="grocery-btn-secondary"
                onClick={handleClearChecked}
                disabled={!hasChecked}
              >
                Clear checked ({checkedItems.length})
              </button>
            </div>
            {isLoading ? (
              <p className="grocery-empty">Loading...</p>
            ) : items.length === 0 ? (
              <p className="grocery-empty">Your grocery list is empty. Add items from recipes or type above.</p>
            ) : (
              <div className="grocery-list">
                <AnimatePresence initial={false}>
                  {groupedUncheckedItems.map((category) => (
                  <motion.section
                    key={category.key}
                    className="grocery-category-group"
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                  >
                    <div className="grocery-category-heading">
                      <span>{category.label}</span>
                      <small>{category.items.length}</small>
                    </div>
                    {category.items.map((item) => (
                      <motion.label
                        key={item.id}
                        className="grocery-item"
                        layout
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.09, ease: "easeOut" }}
                      >
                        <input
                          type="checkbox"
                          className="grocery-item-checkbox"
                          checked={pendingCheckedIds.has(item.id)}
                          onChange={() => handleToggle(item.id)}
                          aria-label={`Mark ${item.item_text} as done`}
                        />
                        <span className="grocery-item-label">{item.item_text}</span>
                      </motion.label>
                    ))}
                  </motion.section>
                  ))}
                </AnimatePresence>
                {checkedItems.length > 0 && (
                  <details className="grocery-checked-details">
                    <summary>
                      Checked off <span>{checkedItems.length}</span>
                    </summary>
                    <AnimatePresence initial={false}>
                      {checkedItems.map((item) => (
                      <motion.label
                        key={item.id}
                        className="grocery-item checked-row"
                        layout
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.09, ease: "easeOut" }}
                      >
                        <input
                          type="checkbox"
                          className="grocery-item-checkbox"
                          checked
                          onChange={() => handleToggle(item.id)}
                          aria-label={`Unmark ${item.item_text}`}
                        />
                        <span className="grocery-item-label checked">{item.item_text}</span>
                      </motion.label>
                      ))}
                    </AnimatePresence>
                  </details>
                )}
              </div>
            )}
          </section>
          <div
            ref={summarySlotRef}
            className="grocery-summary-slot"
            style={{ minHeight: summaryPin.isPinned ? summaryPin.height : undefined }}
          >
            <aside
              ref={summaryCardRef}
              className={`grocery-summary-card ${summaryPin.isPinned ? "is-pinned" : ""}`}
              style={
                summaryPin.isPinned
                  ? { left: summaryPin.left, width: summaryPin.width }
                  : undefined
              }
              aria-label="Shopping summary"
            >
              <h2>Shopping summary</h2>
              <div className="grocery-progress-track">
                <motion.span
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                />
              </div>
              <div className="grocery-progress-row">
                <span>Progress</span>
                <strong>{progress}%</strong>
              </div>
              <div className="grocery-summary-stats">
                <div>
                  <span>Total items</span>
                  <strong>{items.length}</strong>
                </div>
                <div>
                  <span>Checked off</span>
                  <strong className="green">{checkedItems.length}</strong>
                </div>
                <div>
                  <span>Categories</span>
                  <strong>{categoryCounts.filter((category) => category.total > 0).length}</strong>
                </div>
                <div>
                  <span>Remaining</span>
                  <strong>{uncheckedItems.length}</strong>
                </div>
              </div>
              <h3>By category</h3>
              <div className="grocery-summary-categories">
                {categoryCounts.map((category) => (
                  <div key={category.key} className="grocery-summary-category">
                    <span>{category.label}</span>
                    <small>
                      {category.checked}/{category.total}
                    </small>
                    <div className="grocery-mini-track">
                      <motion.span
                        initial={false}
                        animate={{
                          width:
                            category.total === 0
                              ? "0%"
                              : `${Math.round((category.checked / category.total) * 100)}%`,
                        }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="grocery-instacart-btn">
                Order Instacart
              </button>
              <button
                type="button"
                className="grocery-summary-clear-btn"
                onClick={handleClearChecked}
                disabled={!hasChecked}
              >
                Clear checked
              </button>
            </aside>
          </div>
        </div>
      </div>
      {isCalendarOpen && (
        <div
          className="grocery-calendar-overlay"
          onClick={() => setIsCalendarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsCalendarOpen(false)}
          role="button"
          tabIndex={0}
        >
          <div
            className="grocery-calendar-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="grocery-calendar-title"
          >
            <div className="grocery-calendar-modal-header">
              <h2 id="grocery-calendar-title">Plan your grocery trip</h2>
              <button
                type="button"
                className="grocery-calendar-close-btn"
                onClick={() => setIsCalendarOpen(false)}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div className="grocery-calendar-option-card">
              <label className="grocery-calendar-option-label">
                <input
                  type="radio"
                  name="calendar-mode"
                  checked={calendarMode === "date"}
                  onChange={() => setCalendarMode("date")}
                />
                <span>Pick a specific date</span>
              </label>
              {calendarMode === "date" && (
                <input
                  type="date"
                  className="grocery-calendar-date-input"
                  value={calendarDate}
                  onChange={(e) => setCalendarDate(e.target.value)}
                />
              )}
            </div>
            <div className="grocery-calendar-option-card">
              <label className="grocery-calendar-option-label">
                <input
                  type="radio"
                  name="calendar-mode"
                  checked={calendarMode === "relative"}
                  onChange={() => setCalendarMode("relative")}
                />
                <span>Quick pick</span>
              </label>
              {calendarMode === "relative" && (
                <div className="grocery-calendar-quick-pick">
                  {QUICK_PICK_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      className={`grocery-calendar-quick-pick-btn ${relativeDays === opt.days ? "active" : ""}`}
                      onClick={() => setRelativeDays(opt.days)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {getPlannedDate() && (
              <p className="grocery-calendar-preview">
                Will add: {formatDateForPreview(getPlannedDate()!)}
              </p>
            )}
            <div className="grocery-calendar-btns">
              <button
                type="button"
                className="grocery-calendar-cancel"
                onClick={() => setIsCalendarOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="grocery-calendar-confirm"
                onClick={handleAddToCalendar}
              >
                Add to calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
