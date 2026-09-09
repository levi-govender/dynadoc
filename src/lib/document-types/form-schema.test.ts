import assert from "node:assert/strict";
import test from "node:test";
import { emptyDraftSnapshot } from "./defaults";
import {
  addField,
  addGroup,
  deleteGroup,
  moveField,
  setFieldRequired,
  setGroupRepeatable,
} from "./form-schema";

test("addField uses a stable UUID id and can mark required", () => {
  const form = emptyDraftSnapshot().formSchema;
  const groupId = form.groups[0]?.id;
  assert.ok(groupId);
  const withField = addField(form, groupId, "text");
  const field = withField.groups[0]?.fields[0];
  assert.ok(field);
  assert.match(field.id, /^[0-9a-f-]{36}$/i);
  const required = setFieldRequired(withField, groupId, field.id, true);
  assert.equal(required.groups[0]?.fields[0]?.required, true);
  const again = setFieldRequired(required, groupId, field.id, true);
  assert.equal(again.groups[0]?.fields[0]?.id, field.id);
});

test("moveField reorders without changing ids", () => {
  const form = emptyDraftSnapshot().formSchema;
  const groupId = form.groups[0]?.id ?? "";
  let next = addField(form, groupId, "text");
  next = addField(next, groupId, "number");
  const firstId = next.groups[0]?.fields[0]?.id ?? "";
  const secondId = next.groups[0]?.fields[1]?.id ?? "";
  next = moveField(next, groupId, secondId, -1);
  assert.deepEqual(
    next.groups[0]?.fields.map((field) => field.id),
    [secondId, firstId],
  );
});

test("deleteGroup keeps at least one group", () => {
  const form = emptyDraftSnapshot().formSchema;
  const only = deleteGroup(form, form.groups[0]?.id ?? "");
  assert.equal(only.groups.length, 1);
  const two = addGroup(form);
  assert.equal(two.groups.length, 2);
  const one = deleteGroup(two, two.groups[1]?.id ?? "");
  assert.equal(one.groups.length, 1);
});

test("setGroupRepeatable marks a group for row answers", () => {
  const form = emptyDraftSnapshot().formSchema;
  const groupId = form.groups[0]?.id ?? "";
  const next = setGroupRepeatable(form, groupId, true);
  assert.equal(next.groups[0]?.repeatable, true);
});
