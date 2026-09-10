import { test } from "node:test"
import assert from "node:assert/strict"
import { mapSsoProfile } from "./sso-profile.ts"

test("the product's admin role makes the user an admin", () => {
  const u = mapSsoProfile(
    { email: "A@Example.com", email_verified: true, name: "Ada", roles: ["tornade:admin", "spore:admin"] },
    "tornade:admin",
  )
  assert.equal(u.role, "admin")
  assert.equal(u.email, "a@example.com")
  assert.equal(u.name, "Ada")
  assert.equal(u.emailVerified, true)
})

test("another product's admin role does not", () => {
  const u = mapSsoProfile({ email: "a@example.com", roles: ["spore:admin"] }, "tornade:admin")
  assert.equal(u.role, "user")
})

test("a missing or malformed roles claim is no role", () => {
  assert.equal(mapSsoProfile({ email: "a@example.com" }, "tornade:admin").role, "user")
  assert.equal(mapSsoProfile({ email: "a@example.com", roles: "tornade:admin" }, "tornade:admin").role, "user")
})

test("a missing name falls back to the mailbox", () => {
  assert.equal(mapSsoProfile({ email: "ada@example.com" }, "x").name, "ada")
})
