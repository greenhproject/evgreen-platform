import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const landingPath = resolve(process.cwd(), "client/src/pages/Landing.tsx");

describe("landing store badges", () => {
  it("uses the approved localized Google Play badge in every Android CTA", () => {
    const source = readFileSync(landingPath, "utf8");

    expect(source).toContain('const GOOGLE_PLAY_BADGE_URL = "/manus-storage/google-play-badge-es-419_ac668aaf.png";');
    expect(source.match(/<GooglePlayBadge(?:\s|\/|>)/g)).toHaveLength(2);
    expect(source).not.toContain('viewBox="0 0 512 512"');
  });
});
