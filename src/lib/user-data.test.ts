import { describe, expect, it } from "vitest";
import { emptyState, type Idea } from "@/lib/domain";
import {
  createStructuredDraft,
  type StructuredRegistration,
} from "@/lib/structured-registration";
import { buildMentorContext } from "@/lib/mentor-context";
import { normalizeIncomingData } from "./user-data";

const idea: Idea = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "دسترسی محلی",
  seed: "رفت‌وآمد سالمندان به بازار دشوار است",
  status: "initial",
  stage: "initial",
  answers: [],
  proposal: {},
  tokens: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function snapshot(ideas: Idea[], registrations: StructuredRegistration[] = []) {
  return {
    version: 0,
    state: { ...emptyState(), profile: { name: "کاربر", verified: true }, ideas },
    registrations,
  };
}

describe("user-owned data", () => {
  it("normalizes a valid owner snapshot and preserves server version", () => {
    const result = normalizeIncomingData(snapshot([idea]));
    expect(result.version).toBe(0);
    expect(result.state.ideas[0].id).toBe(idea.id);
  });

  it("rejects duplicate IDs, non-UUID IDs, and more than three total records", () => {
    expect(() => normalizeIncomingData(snapshot([idea, idea]))).toThrow(
      "invalid_snapshot",
    );
    expect(() =>
      normalizeIncomingData(snapshot([{ ...idea, id: "client-id" }])),
    ).toThrow("invalid_snapshot");

    const records = Array.from({ length: 3 }, () => createStructuredDraft());
    expect(() => normalizeIncomingData(snapshot([idea], records))).toThrow(
      "invalid_snapshot",
    );
  });

  it("builds mentor context from complete stored form and workbook answers without contact fields", () => {
    const registration = createStructuredDraft();
    registration.data.problem = "دسترسی سالمندان به بازار سخت است";
    registration.data.fullName = "نام خصوصی";
    registration.data.email = "private@example.test";
    registration.workbooks.C.answers.need = "مسیر بازار پله‌های زیادی دارد";
    const context = buildMentorContext({
      version: 1,
      state: { ...emptyState(), ideas: [idea] },
      registrations: [registration],
    });

    expect(context).toHaveLength(2);
    expect(JSON.stringify(context)).toContain("مسیر بازار پله‌های زیادی دارد");
    expect(JSON.stringify(context)).toContain("رفت‌وآمد سالمندان");
    expect(JSON.stringify(context)).not.toContain("private@example.test");
    expect(JSON.stringify(context)).not.toContain("نام خصوصی");
  });
});
