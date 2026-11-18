# 情報システム学科 handbook pilot

The planner supports 2023–2026 entrants in 情報システム学科 through handbook mode. The 2022 combination displays データ未対応 because its handbook PDF was unavailable.

## Curriculum and timetable coverage

Page references are one-based PDF page numbers in the supplied `media-YYYY.pdf` editions. Course rows were extracted from the supplied layout text. PDF coordinates resolved split lines and preserved the eight printed semester cells in order. Common rows for 2023, 2024, and 2026 retain their existing IDs and provenance. Their printed course-number counts agree with the supplied editions. The 2025 common rows come from the supplied 2025 edition.

| Entry year | Faculty common rows and PDF pages | 情報システム学科 table | Supplementary 全学部共通 table | Loaded rows | Matched 2026 classes | Distinct matched courses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023 | 189, pp. 80–82 | 64, p. 107 | — | 253 | 192 (42 department, 150 common) | 110 (34 department, 76 common) |
| 2024 | 192, pp. 78–81 | 64, p. 105 | — | 256 | 192 (42 department, 150 common) | 110 (34 department, 76 common) |
| 2025 | 193, pp. 79–82 | 64, p. 106 | 12, p. 107 | 269 | 192 (42 department, 150 common) | 110 (34 department, 76 common) |
| 2026 | 191, pp. 80–82 | 64, p. 105 | 8, p. 106 | 263 | 87 (23 department, 64 common) | 45 (17 department, 28 common) |

In each edition, the 64 department rows comprise 29 専門基礎科目 totaling 43 offered credits and 35 専門科目 totaling 71 offered credits. The required rows sum to the printed 13 and 27 credits respectively. The two △ rows offer four credits altogether and the printed minimum is two. The tables print graduation minima of 33 and 60 credits for these categories. A printed total for all offered rows was unavailable. The supplementary tables contribute 5 offered foundation credits and 7 offered professional credits in both 2025 and 2026. The 2025 faculty common table also reconciles with the printed 4 required English skills credits and one-credit minimum across four half-credit 基礎体育 choices.

The timetable counts count classes once regardless of meeting count. Reuse still requires slots, explicit cohort coverage on every meeting, and a unique normalized title and credit match. The 2025 社会メディア学科 source explicitly restricts four otherwise matching classes in each of 2023–2025 and three in 2026 to their own department, so these are excluded. The original syllabi remain labeled references. No research course matched a reusable class in the supplied timetable collection.

## Rule sources and implementation

| Rule | Encoded values | 2023 PDF | 2024 PDF | 2025 PDF | 2026 PDF |
| --- | --- | --- | --- | --- | --- |
| Graduation and category minima | 124 total. 外国語 8, 体育 1, 教養 10, 専門基礎 33, 専門 60, 自由選択 12. Surplus eligible credits count toward 自由選択. | pp. 59–60, 108 | pp. 58–59 | pp. 59–60, 108 | pp. 60–61, 107 |
| Faculty common requirements | Four required English skills credits and four other foreign-language credits. Two 基礎体育 courses totaling one credit. | p. 59 | p. 58 | p. 59 | p. 60 |
| Department required and △ credits | 13 required foundation credits and 27 required professional credits (16 学科基盤, 3 学科専門, 8 research). One unnumbered △ group, with two credits from プログラミング演習A／B. | pp. 60, 107 | pp. 59, 105 | pp. 60, 106 | pp. 61, 105 |
| 数理・データサイエンス | At least one DS credit and four combined DS/MS credits. The department’s required foundation and professional courses satisfy the rule. | pp. 59, 61, 107–108 | pp. 58, 60, 105–106 | pp. 59, 61, 106 | pp. 60, 62, 105 |
| Credit family caps | 特別講義 and 教養ゼミナール each cap at 4 credits. 教養特別講義 caps at 4 in 2023 and 6 thereafter. Excess is excluded from graduation credit. | pp. 58–60 | pp. 57–59 | pp. 58–60 | pp. 59–61 |
| Registration cap | 20 per semester, 24 with relaxation in 2023–2024. 24 per semester, 28 with department permission in 2025–2026. Published f-GPA threshold is ≥4.0 in all four editions. | p. 58 | p. 57 | p. 58 | p. 59 |
| Third-year progression and 事例研究 | 66 graduation-countable credits and 24 months of enrollment excluding leave. Progression is at the start of an academic year. The department guidance gives a four-year limit through year two. 事例研究 starts after third-year progression. | pp. 66–67, 108 | pp. 66, 106 | pp. 68, 108 | pp. 69, 107 |
| 卒業研究(1) | 100 graduation-countable credits, completion of 事例研究, and 36 months of enrollment excluding leave. The 2023 and 2024 department guidance states an enrollment-duration exception for transfer and readmitted students. | pp. 66–67, 108 | pp. 66, 106 | pp. 68, 108 | pp. 69–70, 107 |
| 卒業研究(2) | Completion of 卒業研究(1), with the two courses taken in successive order in separate semesters. | pp. 67, 108 | pp. 66, 106 | pp. 68, 108 | pp. 70, 107 |

## Discrepancies and unverified items

- The 2023 and 2024 履修要綱 §3-2-3 give an 8-credit figure. The three research courses sum to 8 credits. Adding the 16 and 3 credits specified in §§3-2-4 and 3-2-5 reconciles the figure with the printed 27-credit professional required subtotal. Both editions record the wording difference in `issues`.
- The 2023 progression pages had corrupt extracted text. PDF images of pp. 66–67 and the readable department guidance on p. 108 confirmed the rules.
- The 2024 shared rows retain provenance from the preexisting 144-page PDF. The supplied 145-page PDF has the same 192 printed course numbers across pp. 78–81.
- The 2025 handbook prints LA-13H for both 日本文化論 and キャリアデザイン基礎 (pp. 81–82). Both rows have distinct IDs. 日本語基礎(1) and 日本語基礎(2) are retained as graduation-credit exclusions from p. 80.
- Later corrections, the current applicability of older CAP rules, department permission, individual enrollment and leave histories, transfer and readmission decisions, and credit recognition are unverified. Progress checks use entered completions and display the published enrollment conditions for manual confirmation. The separate 数理・データサイエンス・AI応用基礎 program is outside the graduation-credit checks.
- The supplied openings cover only part of the 2026 timetable. Same-title reference matches do not verify current class assignment, individual permission, or a department-specific syllabus. Handbook plans are saved through JSON export and import.

## Validation

- `npm test` was attempted. The sandbox rejected the TSX launcher’s IPC socket with `EPERM`. The same test files ran via `node --import tsx --test --test-isolation=none tests/*.test.ts`, with **57 passed and 0 failed**.
- `npm run typecheck` passed.
- `npm run build` passed and generated the static site locally.

## Files changed

- `README.md`
- `REPORT-is-pilot.md`
- `src/app/layout.tsx`
- `src/components/experience.tsx`
- `src/components/handbook-planner.tsx`
- `src/components/landing.tsx`
- `src/components/planner.tsx`
- `src/data/information-systems-catalog.json`
- `src/lib/handbooks.ts`
- `tests/handbooks.test.ts`

The two 社会メディア学科 catalog JSON files retain their original contents. The brief and handbook sources remain untracked. No commits, pushes, or deployments were made.
