# Complete English Localization and Left-to-Right UI for Javaneh

As a senior frontend engineer and English-language localization specialist, fully localize this existing project in English and make its interface left-to-right. The goal is to localize the real Javaneh product, not to create a mockup, translate only the first screen, or perform an unrelated redesign. Implement the changes in the project code, test them, and report the results.

## Goal and scope

All user-visible text across every page and application state must be clear, natural, consistent English. The default interface direction must be left-to-right, and layout, spacing, directional icons, forms, and mobile views must all work correctly in LTR. Use Western digits consistently for numbers shown in the interface, including counters and dates.

Do not rewrite or translate participant-authored free text without permission; keep answers and ideas exactly as their authors entered them. All fixed product copy, including mentor questions, defaults, and error messages, must be in English.

## Inspect the project first

Before making changes:

1. Review the files, dependencies, application run instructions, and existing tests.
2. Trace the current flows and logic in `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/api/mentor/route.ts`, and `src/lib/domain.ts`.
3. Find all interface states and user-facing strings. Do not limit the search to fixed text: include accessibility labels, errors, loading messages, mentor responses, empty states, dates, and state-dependent content.
4. Preserve existing user changes. Do not alter product logic, storage, the three-idea limit, scoring, or submission deadlines without a clear need.

## Localize every flow into English

Replace all non-English and mixed-language fixed interface text with natural, clear, respectful English. Use language that is easy to understand and consistent throughout the product; avoid literal or awkward translations. Use consistent terminology across the app. For example, choose one term for `tokens` and retain the explanation that the score is only a demo measure.

At minimum, cover all of the following:

- Page title, metadata descriptions, document language, accessible logo/product name, header, demo-mode badge, privacy notice, and footer.
- Welcome page and idea form: heading, description, guidance, example idea, placeholder, character counter, number of ideas used, validation, and buttons.
- Participant details and demo verification: every label, privacy guidance, inputs, masked number, code explanation, errors, back and resend actions. Make clear that no real SMS is sent.
- Initial intake: headings, section names, all five questions, mentor text, thinking state, input text, counter, “I’m not sure yet” option, answer history, summary, and confirmation.
- Mentor-assisted development: headings, names of all ten sections, questions, interface text and states, buttons, history, guidance, and back/continue flow.
- Dashboard: headings, idea and token summaries, stages and progress percentages, every status label, update dates, token history, per-idea actions, empty state, and three-idea limit.
- Review and submission: every proposal form heading, explanation of information sources, deadline date and countdown, save/review/submit actions, local-demo limitation warning, and automatic-submission explanation.
- Success and submitted-proposal views: heading, status, date and time, demo score, section names, and return action.
- Validation and API errors, mentor errors or unavailability, demo-mentor fallback, success messages, loading text, and every other fixed output.
- `aria-label`s, `aria-describedby` text, screen-reader-accessible names, visually hidden text, metadata titles/descriptions, and strings used only by assistive technology or live announcements.

No fixed non-English text should remain in the interface. Preserve the product name “Javaneh” as written; do not break product behavior or internal identifiers. Do not translate user-authored words or text, identifiers, storage keys, or internal data.

## Mentor and server

- Localize fixed mentor questions, demo mentor messages, errors, and fixed responses in `src/app/api/mentor/route.ts` into English as well.
- Update the model system instructions so mentor replies use clear, natural English while preserving existing principles: ask one question at a time, do not invent evidence or statistics, respect participant agency, and do not request sensitive information.
- Do not present an English provider/model response as fixed interface text. Follow the existing response contract and language instructions; on failure, retain the existing safe behavior and fallback.
- Continue to process participant numbers and data correctly for validation and redaction. National ID and mobile numbers must not be sent to the mentor or persisted.

## Make the interface truly left-to-right

1. Set the document attributes to `lang="en"` and `dir="ltr"`. Remove or correct any current global RTL direction so no page is unintentionally right-to-left.
2. Review every page and shell component: header, notices, forms, mentor/chat, cards, dashboard rows, lists, progress bars, proposal summary, footer, empty states, and responsive layouts.
3. Prefer logical CSS properties such as `margin-inline`, `padding-inline`, `inset-inline`, `border-inline`, and `text-align: start/end` where they improve maintainability. Review all rules and media queries; retain physical left/right properties only where the direction is intentionally fixed.
4. Check the visual and semantic order of back/continue icons, arrows, and directional controls for LTR. Decorative icons need not be flipped; do not reverse search, checkmark, or similar icons without reason.
5. Keep intentionally centered text and sections centered. LTR does not mean left-aligning centered content or changing the semantic order of content.
6. Render dates, phone numbers, email addresses, URLs, verification codes, and any remaining intentionally non-English user content correctly alongside English text. Use `dir="rtl"` and appropriate bidirectional isolation such as `<bdi>` only for specific RTL fragments that need it; do not change the entire page direction to fix a local exception.
7. Test LTR layouts at mobile and desktop widths. There must be no horizontal overflow, unexpected column reversal, or obscured content or buttons.

## Typography

- First inspect the existing fonts and font setup. Reuse an existing readable font with good English support if appropriate; do not rename another font to make it appear to be a different font.
- If the existing font is unsuitable and a change is necessary, use a trustworthy, appropriately licensed source and a loading method compatible with Next.js and the project build. Avoid untrusted sources and fragile CSS `@import` font loading.
- Apply the selected font consistently to body text, form controls, buttons, notices, headings, and all interface states. Check font inheritance for `button`, `input`, `textarea`, and other form elements; define sensible system fallbacks.
- Adjust font sizes, weights, line heights, wrapping, letter spacing, and control heights for readable English. Remove letter spacing that harms legibility. Preserve the app’s current calm green visual style and avoid an unnecessary redesign.
- Check both decorative headings and small text for consistent typography; no portion of the interface should unintentionally retain a mismatched font.

## Numbers, dates, and numeric inputs

- Use a shared, testable approach for displaying Western digits (`0123456789`), such as appropriate `Intl` formatting, rather than scattered, one-off JSX conversions.
- Use Western digits for all displayed interface numbers: character counters, step numbers, idea limits and totals, progress percentages, token totals and changes, row numbers, values in interface copy, remaining-hour countdowns, dates and times, and any numbers generated in interface messages. Do not overlook numbers in `<input>` elements or dynamic output.
- Format dates consistently in English, using an appropriate English locale. Keep stored dates and deadline calculations as valid canonical timestamps independent of their presentation format. Never store expiration times as localized date strings or digits.
- Where users may enter numbers, accept Persian (`۰…۹`), Arabic (`٠…٩`), and Western (`0…9`) digits as appropriate. Normalize them to a canonical form in the logic layer before validation so existing OTP, mobile number, and national ID checks continue to work. Use English labels and input guidance.
- Do not automatically convert or rewrite digits in participant-authored free text; interface formatting and user data are separate concerns.

## Preserve existing behavior

- Fully preserve existing capabilities: initial intake and idea development, mentor conversations, local save and restore, draft editing and continuation, the three-idea limit, scoring, review, immediate submission, submission with a 72-hour deadline, and status transition after the deadline.
- Do not add a dependency on an external service, database, real account, paid API, or secret key. Never expose a secret to the client.
- Keep date comparisons and validation based on canonical, machine-processable data; localization is presentation only. Preserve compatibility with existing stored data where possible.
- Preserve accessibility features, contrast, keyboard focus, `aria-live` announcements, reduced-motion support, and appropriately sized touch targets.
- Make only changes related to English localization and LTR. Do not translate TypeScript identifiers, data field names, domain statuses, or storage keys.

## Acceptance criteria and final verification

After implementation:

1. Review every page and state in the browser: welcome, details, demo verification, both mentor stages, dashboard, empty/idea-limit states, review, deadline, submission, and success.
2. Search for unintended RTL direction, remaining non-English fixed interface text, direction-specific CSS, inconsistent typography, incorrectly oriented icons, non-Western interface digits, and mobile overflow. Remove all such issues. Any remaining non-English text must be limited to user-authored content or a specific, intentionally isolated fragment that must remain as entered.
3. Add or run focused tests for digit normalization, date formatting, Persian/Arabic/Western numeric input, and preservation of deadline calculations.
4. Verify that expiration dates and validation are unchanged by English formatting and that existing stored data remains readable.
5. Run the existing tests and relevant project commands: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Fix regressions caused by the changes, and do not report a command as successful if it was not run.
6. Finish with a brief summary of the changes, key files, any font-loading approach, and the commands actually run and their results.

Now inspect the project and implement these changes in the existing code. Do not return only a plan or proposal.
