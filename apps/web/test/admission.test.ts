import { describe, expect, it } from "bun:test";
import { admit, type AdmissionInput } from "../lib/admission";

const base: AdmissionInput = {
  githubLogin: "someone",
  open: true,
  ownerLogin: "ultim8xyz",
  ownerTaken: true,
  invited: false,
};

describe("admit, door open", () => {
  it("lets in any GitHub account", () => {
    expect(admit(base)).toBe("member");
  });

  it("does not need an invite", () => {
    expect(admit({ ...base, invited: false })).toBe("member");
  });

  it("still refuses a login it cannot read", () => {
    expect(admit({ ...base, githubLogin: null })).toBeNull();
  });

  it("does not hand out a second owner", () => {
    expect(admit({ ...base, githubLogin: "ultim8xyz", ownerTaken: true })).toBe("member");
  });

  it("makes the configured owner the owner while the seat is free", () => {
    expect(admit({ ...base, githubLogin: "ultim8xyz", ownerTaken: false })).toBe("owner");
  });

  it("works with no owner configured at all", () => {
    expect(admit({ ...base, ownerLogin: null, ownerTaken: false })).toBe("member");
  });
});

describe("admit, door shut", () => {
  const shut = { ...base, open: false };

  it("refuses a stranger", () => {
    expect(admit(shut)).toBeNull();
  });

  it("lets in an invited login", () => {
    expect(admit({ ...shut, invited: true })).toBe("member");
  });

  it("still crowns the owner", () => {
    expect(admit({ ...shut, githubLogin: "ultim8xyz", ownerTaken: false })).toBe("owner");
  });
});
