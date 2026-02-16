"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getGroceryItems,
  addGroceryItem,
  toggleGroceryItemChecked,
  clearCheckedGroceryItems,
} from "@/app/actions/grocery-items";
import { createGroceryTrip } from "@/app/actions/grocery-trips";
import "@/app/styling/GroceryList.css";

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

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => formatDateForInput(new Date()));
  const [calendarMode, setCalendarMode] = useState<"date" | "relative">("date");
  const [relativeDays, setRelativeDays] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const res = await getGroceryItems();
    if (res.data) setItems(res.data as GroceryItem[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (calendarMode === "date") {
      setCalendarDate(formatDateForInput(new Date()));
    }
  }, [calendarMode]);

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
    await toggleGroceryItemChecked(id);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  }

  async function handleClearChecked() {
    const checkedCount = items.filter((i) => i.checked).length;
    if (checkedCount === 0) return;
    await clearCheckedGroceryItems();
    setItems((prev) => prev.filter((i) => !i.checked));
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

  return (
    <div className="right-side-panel">
      <div className="grocery-page">
        <h1>Grocery List</h1>
        <div className="grocery-add-row">
          <input
            type="text"
            className="grocery-add-input"
            placeholder="Add an item..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
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
        <div className="grocery-actions">
          <button
            type="button"
            className="grocery-btn-secondary"
            onClick={() => setIsCalendarOpen(true)}
          >
            Add to calendar
          </button>
          <button
            type="button"
            className="grocery-btn-secondary"
            onClick={handleClearChecked}
            disabled={!hasChecked}
          >
            Clear checked
          </button>
        </div>
        {isLoading ? (
          <p className="grocery-empty">Loading...</p>
        ) : items.length === 0 ? (
          <p className="grocery-empty">Your grocery list is empty. Add items from recipes or type above.</p>
        ) : (
          <ul className="grocery-list">
            {uncheckedItems.map((item) => (
              <li key={item.id} className="grocery-item">
                <input
                  type="checkbox"
                  className="grocery-item-checkbox"
                  checked={false}
                  onChange={() => handleToggle(item.id)}
                  aria-label={`Mark ${item.item_text} as done`}
                />
                <span className="grocery-item-label">{item.item_text}</span>
              </li>
            ))}
            {checkedItems.map((item) => (
              <li key={item.id} className="grocery-item">
                <input
                  type="checkbox"
                  className="grocery-item-checkbox"
                  checked
                  onChange={() => handleToggle(item.id)}
                  aria-label={`Unmark ${item.item_text}`}
                />
                <span className="grocery-item-label checked">{item.item_text}</span>
              </li>
            ))}
          </ul>
        )}
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
