import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("shows the number with its unit and flags hindsight", () => {
    render(<StatCard label="Outturn" value="148" unit="GWh" variant="hindsight" badge="Hindsight" />);
    expect(screen.getByText("148")).toBeInTheDocument();
    expect(screen.getByText("GWh")).toBeInTheDocument();
    expect(screen.getByText("Hindsight")).toHaveClass("badge--hindsight");
  });

  it("marks our basis with the highlighted variant", () => {
    const { container } = render(<StatCard label="Error-adjusted expectation" value="146" variant="basis" badge="Our basis" />);
    expect(container.firstChild).toHaveClass("stat--basis");
    expect(screen.getByText("Our basis")).toHaveClass("badge--basis");
  });
});
