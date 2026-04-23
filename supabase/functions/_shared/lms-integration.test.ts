import { describe, expect, it } from "vitest";
import { buildSignedLmsRequest, createHs256Jwt, hmacSha256Hex, stableJson } from "./lms-integration";

const decodeBase64UrlJson = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
};

describe("LMS integration helpers", () => {
  it("gera JSON estavel ordenando chaves em objetos e preservando arrays", () => {
    const body = {
      z: 1,
      a: {
        c: 3,
        b: [{ d: 4, a: 1 }],
      },
    };

    expect(stableJson(body)).toBe('{"a":{"b":[{"a":1,"d":4}],"c":3},"z":1}');
  });

  it("assina timestamp e JSON estavel com HMAC SHA-256", async () => {
    const body = { user: { email: "a@b.com", external_user_id: "u1" }, request_id: "r1" };
    const signed = await buildSignedLmsRequest(body, "secret", "2026-04-23T12:00:00.000Z");
    const expected = await hmacSha256Hex(
      '2026-04-23T12:00:00.000Z.{"request_id":"r1","user":{"email":"a@b.com","external_user_id":"u1"}}',
      "secret",
    );

    expect(signed.stableBody).toBe('{"request_id":"r1","user":{"email":"a@b.com","external_user_id":"u1"}}');
    expect(signed.signature).toBe(expected);
  });

  it("gera JWT HS256 com claims do acesso LMS", async () => {
    const token = await createHs256Jwt(
      {
        iss: "homecarematch",
        aud: "homecarematch-lms",
        sub: "user-1",
        external_user_id: "user-1",
        external_course_id: "course-1",
        jti: "jti-1",
        iat: 100,
        exp: 190,
      },
      "jwt-secret",
    );

    const [header, payload, signature] = token.split(".");
    expect(decodeBase64UrlJson(header)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decodeBase64UrlJson(payload)).toMatchObject({
      iss: "homecarematch",
      aud: "homecarematch-lms",
      sub: "user-1",
      external_course_id: "course-1",
      exp: 190,
    });
    expect(signature).toBeTruthy();
  });
});
