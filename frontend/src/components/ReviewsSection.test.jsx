import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReviewsSection from "./ReviewsSection";
import * as AuthContext from "../auth/AuthContext";
import * as apiClient from "../api/client";

const REVIEW = {
  id: 1,
  rating: 4,
  body: "Really nice quality.",
  customer_name: "Priya S.",
  created_at: "2026-01-10T00:00:00Z",
};

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <ReviewsSection productId={1} avgRating={0} reviewCount={0} {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ReviewsSection", () => {
  test("shows existing reviews and the average rating summary", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([REVIEW]);
    renderSection({ avgRating: 4, reviewCount: 1 });

    expect(await screen.findByText("Really nice quality.")).toBeInTheDocument();
    expect(screen.getByText("Priya S.")).toBeInTheDocument();
  });

  test("shows a no-reviews message when there are none", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("No reviews yet.")).toBeInTheDocument();
  });

  test("prompts a logged-out visitor to log in rather than showing a form", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("Log in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit review/i })).not.toBeInTheDocument();
  });

  test("tells an ineligible logged-in customer why they can't review yet", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([]);
    vi.spyOn(apiClient, "fetchMyReview").mockResolvedValue({ eligible: false, review: null });
    renderSection();
    expect(await screen.findByText(/once your order for it has been delivered/i)).toBeInTheDocument();
  });

  test("an eligible customer can submit a new review", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([]);
    vi.spyOn(apiClient, "fetchMyReview").mockResolvedValue({ eligible: true, review: null });
    const submitSpy = vi.spyOn(apiClient, "submitReview").mockResolvedValue({});
    renderSection();

    await screen.findByText("Write a review");
    await userEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    await userEvent.type(screen.getByPlaceholderText(/what did you think/i), "Loved it.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(1, { rating: 5, body: "Loved it." }));
  });

  test("submit is disabled until a star rating is picked", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([]);
    vi.spyOn(apiClient, "fetchMyReview").mockResolvedValue({ eligible: true, review: null });
    renderSection();

    await screen.findByText("Write a review");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeDisabled();
  });

  test("prefills and offers to edit/delete an existing review", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([REVIEW]);
    vi.spyOn(apiClient, "fetchMyReview").mockResolvedValue({ eligible: true, review: REVIEW });
    renderSection({ avgRating: 4, reviewCount: 1 });

    expect(await screen.findByText("Edit your review")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Really nice quality.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  test("deleting a review calls the API and clears the form", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchProductReviews")
      .mockResolvedValueOnce([REVIEW])
      .mockResolvedValueOnce([]);
    vi.spyOn(apiClient, "fetchMyReview")
      .mockResolvedValueOnce({ eligible: true, review: REVIEW })
      .mockResolvedValueOnce({ eligible: true, review: null });
    const deleteSpy = vi.spyOn(apiClient, "deleteReview").mockResolvedValue();
    renderSection();

    await screen.findByText("Edit your review");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1));
    expect(await screen.findByText("Write a review")).toBeInTheDocument();
  });

  test("shows an error message when submitting fails", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchProductReviews").mockResolvedValue([]);
    vi.spyOn(apiClient, "fetchMyReview").mockResolvedValue({ eligible: true, review: null });
    vi.spyOn(apiClient, "submitReview").mockRejectedValue(new Error("You can only review products from an order that's been delivered to you"));
    renderSection();

    await screen.findByText("Write a review");
    await userEvent.click(screen.getByRole("radio", { name: "3 stars" }));
    await userEvent.type(screen.getByPlaceholderText(/what did you think/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText(/order that's been delivered/i)).toBeInTheDocument();
  });
});
