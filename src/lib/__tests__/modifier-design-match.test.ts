import { describe, it, expect } from "@jest/globals";
import { buildDesignIndex, matchDesignForModifier, modifierThumbnail } from "../modifier-design-match";
import type { DesignAsset } from "@/types";

const design = (over: Partial<DesignAsset> & { id: string }): DesignAsset =>
  ({
    name: over.id,
    category: "",
    image_url: `https://example.test/${over.id}.png`,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as DesignAsset;

describe("buildDesignIndex", () => {
  it("indexes by display label and by raw name, normalised", () => {
    const index = buildDesignIndex([
      design({ id: "d1", name: "Little Stranger Logos", description: "Shrooming Stranger" }),
      design({ id: "d2", name: "Colosso, He's A Villian!" }),
    ]);
    expect(matchDesignForModifier("Shrooming Stranger", index)?.id).toBe("d1");
    expect(matchDesignForModifier("shrooming  stranger", index)?.id).toBe("d1");
    expect(matchDesignForModifier("Little Stranger Logos", index)?.id).toBe("d1");
    expect(matchDesignForModifier("Colosso He's A Villian", index)?.id).toBe("d2");
  });

  it("ignores designs with no image, and unknown names", () => {
    const index = buildDesignIndex([design({ id: "d1", name: "No Art", image_url: "" })]);
    expect(matchDesignForModifier("No Art", index)).toBeUndefined();
    expect(matchDesignForModifier("Something Else", index)).toBeUndefined();
    expect(matchDesignForModifier(undefined, index)).toBeUndefined();
  });

  it("keeps the first design when two share a label", () => {
    const index = buildDesignIndex([
      design({ id: "first", name: "Shared" }),
      design({ id: "second", name: "Shared" }),
    ]);
    expect(matchDesignForModifier("Shared", index)?.id).toBe("first");
  });
});

describe("modifierThumbnail", () => {
  const index = buildDesignIndex([design({ id: "d1", name: "Shrooming Stranger" })]);

  it("falls back to the matched design when nothing is assigned", () => {
    expect(modifierThumbnail({ name: "Shrooming Stranger" }, index)).toBe(
      "https://example.test/d1.png",
    );
  });

  it("prefers an explicitly assigned modifier background", () => {
    expect(
      modifierThumbnail({ name: "Shrooming Stranger" }, index, {
        "Shrooming Stranger": { front: "https://example.test/assigned.png" },
      }),
    ).toBe("https://example.test/assigned.png");
  });

  it("returns nothing for an option with neither", () => {
    expect(modifierThumbnail({ name: "Circle" }, index, {})).toBeUndefined();
  });
});
