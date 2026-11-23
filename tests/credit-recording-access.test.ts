import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreditRecordingAccess, CreditRecordingActions, CustomCompletedList } from "../src/components/credit-recording";
import HandbookPlanner from "../src/components/handbook-planner";
import Planner from "../src/components/planner";
import { DEFAULT_STATE } from "../src/lib/data";

const noop = () => {};
const loginMessage = "ログインすると、修得科目の記録と要件の管理が使えます";

test("shared recording controls replace import, custom addition and deletion with a guest login link", () => {
  const actions = createElement(CreditRecordingActions, { onImport: noop, onCustom: noop });
  const list = createElement(CustomCompletedList, { credits: [{ name: "認定実習", credits: 1, category: "free_electives" }], onRemove: noop });
  const children = createElement("div", null, actions, list);
  const guest = renderToStaticMarkup(createElement(CreditRecordingAccess, { mode: "guest", onLogin: noop, children }));
  const account = renderToStaticMarkup(createElement(CreditRecordingAccess, { mode: "account", onLogin: noop, children }));
  assert.ok(guest.includes(loginMessage));
  assert.match(guest, /<button[^>]+type="button"[^>]*>ログインへ進む<\/button>/);
  for (const control of ["まとめて記録する", "カタログ外の科目を入力", "認定実習を削除"]) {
    assert.ok(!guest.includes(control));
    assert.ok(account.includes(control));
  }
  assert.ok(!account.includes(loginMessage));
});

test("both planners only honor the onboarding import action for accounts, with requirements navigation in standard mode", () => {
  for (const usageMode of ["guest", "account"] as const) {
    const standard = renderToStaticMarkup(createElement(Planner, {
      initialState: DEFAULT_STATE, usageMode, startWithPastCredits: true, onLogin: noop, onStateChange: noop,
      saveStatus: usageMode === "guest" ? "guest" : "saved", saveMessage: "", accountEmail: "",
      onExit: noop, onChooseHandbookProfile: noop, onSignOut: noop,
    }));
    const handbook = renderToStaticMarkup(createElement(HandbookPlanner, {
      profile: { ...DEFAULT_STATE.profile, admissionYear: 2024 },
      usageMode, startWithPastCredits: true, onExit: noop, onLogin: noop,
    }));
    for (const markup of [standard, handbook]) {
      assert.equal(markup.includes('role="dialog"'), usageMode === "account");
      assert.equal(markup.includes("カタログ外の科目を入力"), usageMode === "account");
      assert.ok(markup.includes("修得科目"));
    }
    assert.equal(standard.includes("<span>要件</span>"), usageMode === "account");
    assert.ok(!handbook.includes("<span>要件</span>"));
    if (usageMode === "account") assert.ok(standard.includes("単位数未確認"));
  }
});
