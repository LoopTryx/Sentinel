# WhatsApp reward/payment context correction

Root causes: reward + ordinary action words alone reached the unknown-sender threshold, while numeric payment requests stopped before k/$ suffixes. Numeric payment requests therefore did not create the credentials category or direct-request bonus in the two reported money-draw examples.

Changes: require a configured supporting risk category beyond reward/action. Recognize prefixed/suffixed currencies, k/lakh/crore notation and rupees in payment requests. Add a configurable advance-fee combination bonus for a promised reward plus payment demand plus activation/release wording. Negated payment advice is removed before scoring. No class/school/sender whitelist was added; a class-themed message demanding payment still flags. Saved/trusted contacts retain direct-request warnings. All processing is local; no private chat was opened or uploaded. Screenshot reproductions in tests are anonymized.

Editable policy: apps/extension/data/message-detector-config.js (version 2), including numericRequestPatterns, negatedRequests, combinationPolicy, advanceFeePatterns and bonuses.advanceFee. Extension package version 0.2.15.

Evaluation: 16 targeted synthetic cases (9 legitimate, 7 scams), before: 5 false positives / 2 false negatives; after: 0 / 0. Existing unchanged 80-case synthetic corpus: before 1 FP / 0 FN; after 0 FP / 4 FN. The four retained scam labels t23,t24,t38,h35 contain only bare reward claims without supporting risk. They are explicitly counted as misses, not relabeled or hidden. These are regression results, not a real-world accuracy estimate. Exact results are in the sibling JSON.

Affected tests: 28 passed, including shared email scoring, currency prefixes/suffixes, negation, trusted senders, WhatsApp insertion/recycling and removal of stale badges. Build/source parity smoke passed. Final full extension suite: 136 passed, 0 failed. Actual installed Chrome/WhatsApp acceptance remains pending.
