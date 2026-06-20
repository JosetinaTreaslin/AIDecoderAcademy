-- ══════════════════════════════════════════════════════════════════════
--  Kannada Subject Seed — CBSE Class 10
--  Run in Supabase SQL editor after classroom_migration.sql
-- ══════════════════════════════════════════════════════════════════════

-- ── Chapter 1: ಮಾತೃಭಾಷೆ ಕನ್ನಡ ─────────────────────────────────────────
WITH ch1 AS (
  INSERT INTO public.chapters (subject, chapter_number, chapter_title, grade, board, content_text)
  VALUES (
    'Kannada',
    1,
    'ಮಾತೃಭಾಷೆ ಕನ್ನಡ',
    10,
    'CBSE',
    $content$
ಮಾತೃಭಾಷೆ ಕನ್ನಡ — ಪಾಠ ಸಾರಾಂಶ

ಕನ್ನಡ ಭಾಷೆಯ ಪರಿಚಯ:
- ಕನ್ನಡ ದ್ರಾವಿಡ ಭಾಷಾ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದ ಪ್ರಾಚೀನ ಭಾಷೆ. ಸುಮಾರು 2,500 ವರ್ಷಗಳ ಇತಿಹಾಸ ಇದೆ.
- ಕರ್ನಾಟಕ ರಾಜ್ಯದ ಅಧಿಕೃತ ಭಾಷೆ. ನವೆಂಬರ್ 1 ರಂದು ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ ಆಚರಿಸಲಾಗುತ್ತದೆ.

ಲಿಪಿ ಮತ್ತು ವ್ಯಾಕರಣ:
- ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ 13 ಸ್ವರಗಳು (ಅ, ಆ, ಇ, ಈ, ಉ, ಊ, ಋ, ಎ, ಏ, ಐ, ಒ, ಓ, ಔ) ಮತ್ತು 34 ವ್ಯಂಜನಗಳಿವೆ.
- ಲಿಂಗ: ಪುಲ್ಲಿಂಗ, ಸ್ತ್ರೀಲಿಂಗ, ನಪುಂಸಕಲಿಂಗ — ಮೂರು ಲಿಂಗಗಳಿವೆ.
- ಸಂಧಿ: ಎರಡು ಪದಗಳ ಮಿಲನದಿಂದ ಉಂಟಾಗುವ ಬದಲಾವಣೆ. ಉದಾ: ರವಿ + ಇಂದ್ರ = ರವೀಂದ್ರ.
- ಅಲಂಕಾರ: ಕಾವ್ಯದ ಸೌಂದರ್ಯ ವರ್ಧಿಸುವ ಅಂಶ. ಉಪಮೆ, ರೂಪಕ, ಅನುಪ್ರಾಸ ಮುಖ್ಯ ಅಲಂಕಾರಗಳು.
- ಛಂದಸ್ಸು: ವೃತ್ತ (ಅಕ್ಷರ ಸಂಖ್ಯೆ ಮತ್ತು ಗಣ ನಿರ್ದಿಷ್ಟ), ಮಾತ್ರಾ ಛಂದ, ಅಕ್ಕರ ಛಂದ.

ಪ್ರಮುಖ ಕವಿಗಳು:
- ಆದಿಕವಿ ಪಂಪ (ವಿಕ್ರಮಾರ್ಜುನ ವಿಜಯ, ಆದಿಪುರಾಣ)
- ರನ್ನ, ಪೊನ್ನ, ಜನ್ನ — ನಾಲ್ಕು ಮಹಾಕವಿಗಳು (ಪಂಪ, ರನ್ನ, ಪೊನ್ನ, ಜನ್ನ)
- ಕುವೆಂಪು — ರಾಷ್ಟ್ರಕವಿ, ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ವಿಜೇತ (ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು)
- ದ.ರಾ.ಬೇಂದ್ರೆ — ಅಂಬಿಕಾತನಯದತ್ತ, ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ
- ಶಿವರಾಮ ಕಾರಂತ — ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ

ಮೊದಲ ಗ್ರಂಥ:
- ಕವಿರಾಜ ಮಾರ್ಗ — ಲಭ್ಯ ಕನ್ನಡ ಗ್ರಂಥಗಳಲ್ಲಿ ಮೊದಲನೆಯದು (9ನೇ ಶತಮಾನ)

ಸಾಹಿತ್ಯ ಪ್ರಕಾರಗಳು:
- ಗದ್ಯ (Prose): ಕಾದಂಬರಿ, ಕಥೆ, ಪ್ರಬಂಧ
- ಪದ್ಯ (Poetry): ಶತಕ, ರಗಳೆ, ವಚನ, ತ್ರಿಪದಿ
- ಚಂಪೂ: ಗದ್ಯ ಮತ್ತು ಪದ್ಯ ಮಿಶ್ರಿತ
$content$
  )
  ON CONFLICT (board, grade, subject, chapter_number)
  DO UPDATE SET content_text = EXCLUDED.content_text
  RETURNING id
),

-- ── MCQ paper for Chapter 1 ───────────────────────────────────────────────────
mcq_paper AS (
  INSERT INTO public.question_papers (chapter_id, type, questions, total_marks)
  SELECT id, 'mcq', $questions$
[
  {
    "id": "kn1-mcq-01",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆ ಯಾವ ಭಾಷಾ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದೆ?",
    "options": ["A) ಇಂಡೋ-ಆರ್ಯನ್", "B) ದ್ರಾವಿಡ", "C) ಆಸ್ಟ್ರೋ-ಏಷ್ಯಾಟಿಕ್", "D) ಸೈನೋ-ಟಿಬೆಟನ್"],
    "correct_index": 1,
    "explanation": "ಕನ್ನಡ ದ್ರಾವಿಡ ಭಾಷಾ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದ ಪ್ರಾಚೀನ ಭಾಷೆ, ತೆಲುಗು, ತಮಿಳು ಮತ್ತು ಮಲಯಾಳಂ ಜೊತೆಗೆ."
  },
  {
    "id": "kn1-mcq-02",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕರ್ನಾಟಕ ರಾಜ್ಯೋತ್ಸವ ಯಾವ ದಿನ ಆಚರಿಸಲಾಗುತ್ತದೆ?",
    "options": ["A) ಜನವರಿ 26", "B) ಆಗಸ್ಟ್ 15", "C) ನವೆಂಬರ್ 1", "D) ಅಕ್ಟೋಬರ್ 2"],
    "correct_index": 2,
    "explanation": "ನವೆಂಬರ್ 1, 1956 ರಂದು ಕನ್ನಡ ಭಾಷಿಕ ರಾಜ್ಯ ರಚನೆಯಾಯಿತು. ಆದ್ದರಿಂದ ನವೆಂಬರ್ 1 ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ."
  },
  {
    "id": "kn1-mcq-03",
    "difficulty": "easy",
    "marks": 1,
    "question": "ರಾಷ್ಟ್ರಕವಿ ಎಂದು ಕರೆಯಲ್ಪಡುವ ಕನ್ನಡ ಕವಿ ಯಾರು?",
    "options": ["A) ದ.ರಾ.ಬೇಂದ್ರೆ", "B) ಕುವೆಂಪು", "C) ಪಂಪ", "D) ಶಿವರಾಮ ಕಾರಂತ"],
    "correct_index": 1,
    "explanation": "ಕುವೆಂಪು (ಕುಪ್ಪಳಿ ವೆಂಕಟಪ್ಪ ಪುಟ್ಟಪ್ಪ) ಅವರನ್ನು ರಾಷ್ಟ್ರಕವಿ ಎಂದು ಗೌರವಿಸಲಾಗಿದೆ."
  },
  {
    "id": "kn1-mcq-04",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಎಷ್ಟು ಸ್ವರಗಳಿವೆ?",
    "options": ["A) 10", "B) 12", "C) 13", "D) 16"],
    "correct_index": 2,
    "explanation": "ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ 13 ಸ್ವರಗಳಿವೆ: ಅ, ಆ, ಇ, ಈ, ಉ, ಊ, ಋ, ಎ, ಏ, ಐ, ಒ, ಓ, ಔ."
  },
  {
    "id": "kn1-mcq-05",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಮಾತೃಭಾಷೆ ಎಂದರೆ ______.",
    "options": ["A) ರಾಷ್ಟ್ರ ಭಾಷೆ", "B) ತಾಯಿ ಮಾತನಾಡುವ ಭಾಷೆ", "C) ಸರ್ಕಾರಿ ಭಾಷೆ", "D) ವಿದೇಶಿ ಭಾಷೆ"],
    "correct_index": 1,
    "explanation": "ಮಾತೃಭಾಷೆ ಎಂದರೆ ತಾಯಿ ಮಾತನಾಡುವ ಭಾಷೆ, ಮನೆಯಲ್ಲಿ ಬಳಸುವ ಭಾಷೆ."
  },
  {
    "id": "kn1-mcq-06",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆಗೆ ಎಷ್ಟು ವರ್ಷಗಳ ಇತಿಹಾಸ ಇದೆ?",
    "options": ["A) 1000 ವರ್ಷ", "B) 1500 ವರ್ಷ", "C) 2000 ವರ್ಷ", "D) 2500 ವರ್ಷ"],
    "correct_index": 3,
    "explanation": "ಕನ್ನಡ ಭಾಷೆಗೆ ಸುಮಾರು 2,500 ವರ್ಷಗಳ ಇತಿಹಾಸ ಇದೆ."
  },
  {
    "id": "kn1-mcq-07",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಎಷ್ಟು ವ್ಯಂಜನಗಳಿವೆ?",
    "options": ["A) 25", "B) 30", "C) 34", "D) 36"],
    "correct_index": 2,
    "explanation": "ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ 34 ವ್ಯಂಜನಗಳಿವೆ."
  },
  {
    "id": "kn1-mcq-08",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಆದಿಕವಿ ಎಂದು ಕರೆಯಲ್ಪಡುವ ಕನ್ನಡ ಕವಿ ಯಾರು?",
    "options": ["A) ರನ್ನ", "B) ಪಂಪ", "C) ಪೊನ್ನ", "D) ಜನ್ನ"],
    "correct_index": 1,
    "explanation": "ಪಂಪ ಅವರನ್ನು ಆದಿಕವಿ ಎಂದು ಕರೆಯಲಾಗುತ್ತದೆ. ಅವರ ಮುಖ್ಯ ಕೃತಿಗಳು: ವಿಕ್ರಮಾರ್ಜುನ ವಿಜಯ ಮತ್ತು ಆದಿಪುರಾಣ."
  },
  {
    "id": "kn1-mcq-09",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಸಂಧಿ ಎಂದರೇನು?",
    "options": ["A) ಎರಡು ಪದಗಳ ಮಿಲನದಿಂದ ಆಗುವ ಬದಲಾವಣೆ", "B) ಒಂದು ಪದದ ವಿಭಜನ", "C) ವಾಕ್ಯ ರಚನೆ", "D) ಅಕ್ಷರ ಎಣಿಕೆ"],
    "correct_index": 0,
    "explanation": "ಸಂಧಿ ಎಂದರೆ ಎರಡು ಪದಗಳ ಮಿಲನದಿಂದ ಉಂಟಾಗುವ ಬದಲಾವಣೆ. ಉದಾ: ರವಿ + ಇಂದ್ರ = ರವೀಂದ್ರ."
  },
  {
    "id": "kn1-mcq-10",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆಯ ಮೊದಲ ಲಭ್ಯ ಗ್ರಂಥ ಯಾವುದು?",
    "options": ["A) ರಾಮಾಯಣ", "B) ವಿಕ್ರಮಾರ್ಜುನ ವಿಜಯ", "C) ಕವಿರಾಜ ಮಾರ್ಗ", "D) ಗದಾಯುದ್ಧ"],
    "correct_index": 2,
    "explanation": "ಕವಿರಾಜ ಮಾರ್ಗ (9ನೇ ಶತಮಾನ) ಲಭ್ಯ ಕನ್ನಡ ಗ್ರಂಥಗಳಲ್ಲಿ ಮೊದಲನೆಯದು."
  },
  {
    "id": "kn1-mcq-11",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ವ್ಯಾಕರಣದಲ್ಲಿ ಎಷ್ಟು ಲಿಂಗಗಳಿವೆ?",
    "options": ["A) 2", "B) 3", "C) 4", "D) 5"],
    "correct_index": 1,
    "explanation": "ಕನ್ನಡ ವ್ಯಾಕರಣದಲ್ಲಿ 3 ಲಿಂಗಗಳಿವೆ: ಪುಲ್ಲಿಂಗ, ಸ್ತ್ರೀಲಿಂಗ, ನಪುಂಸಕಲಿಂಗ."
  },
  {
    "id": "kn1-mcq-12",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಅಲಂಕಾರ ಎಂದರೇನು?",
    "options": ["A) ಕಾವ್ಯದ ಸೌಂದರ್ಯ ವರ್ಧಿಸುವ ಅಂಶ", "B) ವ್ಯಾಕರಣ ನಿಯಮ", "C) ಕಾವ್ಯ ಪ್ರಕಾರ", "D) ಗದ್ಯ ಶೈಲಿ"],
    "correct_index": 0,
    "explanation": "ಅಲಂಕಾರ ಎಂದರೆ ಕಾವ್ಯದ ಸೌಂದರ್ಯ ವರ್ಧಿಸುವ ಅಂಶ. ಉಪಮೆ, ರೂಪಕ, ಅನುಪ್ರಾಸ ಮುಖ್ಯ ಅಲಂಕಾರಗಳು."
  },
  {
    "id": "kn1-mcq-13",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಛಂದಸ್ಸಿನಲ್ಲಿ ವೃತ್ತ ಎಂದರೇನು?",
    "options": ["A) ಮಾತ್ರಾ ಲೆಕ್ಕದ ಪದ್ಯ", "B) ಅಕ್ಷರ ಸಂಖ್ಯೆ ಮತ್ತು ಗಣ ನಿರ್ದಿಷ್ಟ ಪದ್ಯ", "C) ಸ್ವತಂತ್ರ ಪದ್ಯ", "D) ಜನಪದ ಗೀತೆ"],
    "correct_index": 1,
    "explanation": "ವೃತ್ತ ಛಂದಸ್ಸಿನಲ್ಲಿ ಅಕ್ಷರ ಸಂಖ್ಯೆ ಮತ್ತು ಗಣ (ಗುರು-ಲಘು) ನಿರ್ದಿಷ್ಟ. ಉದಾ: ಶಾರ್ದೂಲ ವಿಕ್ರೀಡಿತ, ಮಂದಾಕ್ರಾಂತ."
  },
  {
    "id": "kn1-mcq-14",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಪರಿಷತ್ ಸ್ಥಾಪನೆಯಾದ ವರ್ಷ ಯಾವುದು?",
    "options": ["A) 1915", "B) 1920", "C) 1925", "D) 1930"],
    "correct_index": 0,
    "explanation": "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಪರಿಷತ್ 1915 ರಲ್ಲಿ ಸ್ಥಾಪನೆಯಾಯಿತು. ಇದು ಕನ್ನಡ ಭಾಷೆ ಮತ್ತು ಸಾಹಿತ್ಯ ಅಭಿವೃದ್ಧಿಗೆ ಕಾರ್ಯ ನಿರ್ವಹಿಸುತ್ತದೆ."
  },
  {
    "id": "kn1-mcq-15",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ಪಡೆದ ಮೊದಲ ಕನ್ನಡ ಲೇಖಕರು ಯಾರು?",
    "options": ["A) ದ.ರಾ.ಬೇಂದ್ರೆ", "B) ಕುವೆಂಪು", "C) ಶಿವರಾಮ ಕಾರಂತ", "D) ಮಾಸ್ತಿ ವೆಂಕಟೇಶ ಅಯ್ಯಂಗಾರ್"],
    "correct_index": 1,
    "explanation": "ಕುವೆಂಪು (1968) ಕನ್ನಡದ ಮೊದಲ ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ವಿಜೇತರು. ಅವರ ಕಾದಂಬರಿ 'ಶ್ರೀ ರಾಮಾಯಣ ದರ್ಶನಂ' ಗೆ ಈ ಗೌರವ ದೊರೆಯಿತು."
  },
  {
    "id": "kn1-mcq-16",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಚಂಪೂ ಕಾವ್ಯ ಎಂದರೇನು?",
    "options": ["A) ಕೇವಲ ಗದ್ಯ", "B) ಕೇವಲ ಪದ್ಯ", "C) ಗದ್ಯ ಮತ್ತು ಪದ್ಯ ಮಿಶ್ರಿತ", "D) ನಾಟಕ"],
    "correct_index": 2,
    "explanation": "ಚಂಪೂ ಕಾವ್ಯ ಎಂದರೆ ಗದ್ಯ ಮತ್ತು ಪದ್ಯ ಮಿಶ್ರಿತ ಕಾವ್ಯ ಪ್ರಕಾರ. ಪಂಪನ 'ಆದಿಪುರಾಣ' ಒಂದು ಪ್ರಸಿದ್ಧ ಚಂಪೂ."
  },
  {
    "id": "kn1-mcq-17",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ನಾಡಗೀತೆ 'ಜಯ ಭಾರತ ಜನನಿಯ ತನುಜಾತೆ' ರಚಿಸಿದವರು ಯಾರು?",
    "options": ["A) ಕುವೆಂಪು", "B) ಬೇಂದ್ರೆ", "C) ಮಾಸ್ತಿ", "D) ಬಿ.ಎಂ.ಶ್ರೀ"],
    "correct_index": 0,
    "explanation": "ಕರ್ನಾಟಕ ನಾಡಗೀತೆ 'ಜಯ ಭಾರತ ಜನನಿಯ ತನುಜಾತೆ' ರಾಷ್ಟ್ರಕವಿ ಕುವೆಂಪು ಅವರ ರಚನೆ."
  },
  {
    "id": "kn1-mcq-18",
    "difficulty": "easy",
    "marks": 1,
    "question": "'ವಚನ' ಸಾಹಿತ್ಯ ಯಾವ ಕಾಲಘಟ್ಟಕ್ಕೆ ಸೇರಿದ್ದು?",
    "options": ["A) ಪ್ರಾಚೀನ ಕಾಲ", "B) 12ನೇ ಶತಮಾನ", "C) 18ನೇ ಶತಮಾನ", "D) 20ನೇ ಶತಮಾನ"],
    "correct_index": 1,
    "explanation": "ವಚನ ಸಾಹಿತ್ಯ 12ನೇ ಶತಮಾನದ ಬಸವಣ್ಣ ಮತ್ತು ಅವರ ಸಮಕಾಲೀನ ಶರಣರ ಕೊಡುಗೆ."
  },
  {
    "id": "kn1-mcq-19",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯದ 'ಹೊಸಗನ್ನಡ' ಸಾಹಿತ್ಯ ಯಾವ ಅವಧಿಯದ್ದು?",
    "options": ["A) 10-12ನೇ ಶತಮಾನ", "B) 15-18ನೇ ಶತಮಾನ", "C) 19ನೇ ಶತಮಾನ ಮತ್ತು ನಂತರ", "D) 6-9ನೇ ಶತಮಾನ"],
    "correct_index": 2,
    "explanation": "ಹೊಸಗನ್ನಡ ಸಾಹಿತ್ಯ 19ನೇ ಶತಮಾನದಿಂದ ಇಂದಿನವರೆಗಿನ ಅವಧಿಯದ್ದು. ನವೋದಯ, ನವ್ಯ, ದಲಿತ ಸಾಹಿತ್ಯ ಇದರಲ್ಲಿ ಸೇರಿವೆ."
  },
  {
    "id": "kn1-mcq-20",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡದಲ್ಲಿ ಉಪಮೆ ಅಲಂಕಾರದ ಉದಾಹರಣೆ ಯಾವುದು?",
    "options": ["A) 'ಆತ ಸಿಂಹ'", "B) 'ಆತ ಸಿಂಹದಂತೆ ಹೋರಾಡಿದ'", "C) 'ಕಾಡು ನಗುತ್ತಿದೆ'", "D) 'ಸ ಸ ಸ ಸ ಸ'"],
    "correct_index": 1,
    "explanation": "'ಆತ ಸಿಂಹದಂತೆ ಹೋರಾಡಿದ' ಉಪಮೆ ಅಲಂಕಾರ — ಹೋಲಿಕೆ ವಾಚಕ 'ದಂತೆ' ಬಳಸಿ ಹೋಲಿಸಲಾಗಿದೆ."
  },
  {
    "id": "kn1-mcq-21",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆಯ ಒಂದು ಪ್ರಮುಖ ವೈಶಿಷ್ಟ್ಯ ಯಾವುದು?",
    "options": ["A) ಇದು ಇಂಡೋ-ಆರ್ಯನ್ ಭಾಷೆ", "B) ಇದಕ್ಕೆ ತನ್ನದೇ ಆದ ಲಿಪಿ ಇಲ್ಲ", "C) ಇದು ಸ್ವತಂತ್ರ ಲಿಪಿ ಹೊಂದಿದ ಪ್ರಾಚೀನ ಭಾಷೆ", "D) ಇದು ಕೇವಲ ಮೌಖಿಕ ಭಾಷೆ"],
    "correct_index": 2,
    "explanation": "ಕನ್ನಡ ತನ್ನದೇ ಆದ ಸ್ವತಂತ್ರ ಲಿಪಿ ಹೊಂದಿದ ಪ್ರಾಚೀನ ಭಾಷೆ."
  },
  {
    "id": "kn1-mcq-22",
    "difficulty": "medium",
    "marks": 1,
    "question": "ವಚನಕಾರ ಬಸವಣ್ಣ ಅವರ ಕಾಲ ಯಾವುದು?",
    "options": ["A) 9ನೇ ಶತಮಾನ", "B) 10ನೇ ಶತಮಾನ", "C) 12ನೇ ಶತಮಾನ", "D) 15ನೇ ಶತಮಾನ"],
    "correct_index": 2,
    "explanation": "ಬಸವಣ್ಣ 12ನೇ ಶತಮಾನದ ಸಂತ-ಕವಿ. ಅವರ ವಚನಗಳು ಕನ್ನಡ ಸಾಹಿತ್ಯದಲ್ಲಿ ವಿಶಿಷ್ಟ ಸ್ಥಾನ ಪಡೆದಿವೆ."
  },
  {
    "id": "kn1-mcq-23",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯದ ರಗಳೆ ಛಂದಸ್ಸನ್ನು ಜನಪ್ರಿಯಗೊಳಿಸಿದ ಕವಿ ಯಾರು?",
    "options": ["A) ಪಂಪ", "B) ರನ್ನ", "C) ಹರಿಹರ", "D) ಕುಮಾರವ್ಯಾಸ"],
    "correct_index": 2,
    "explanation": "ಹರಿಹರ ರಗಳೆ ಛಂದಸ್ಸನ್ನು ಕನ್ನಡ ಸಾಹಿತ್ಯದಲ್ಲಿ ಜನಪ್ರಿಯಗೊಳಿಸಿದ ಕವಿ."
  },
  {
    "id": "kn1-mcq-24",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಕಾದಂಬರಿ ಸಾಹಿತ್ಯ ಪ್ರಕಾರ ಯಾವ ಭಾಷೆ ವಿಭಾಗಕ್ಕೆ ಸೇರುತ್ತದೆ?",
    "options": ["A) ಪದ್ಯ", "B) ಗದ್ಯ", "C) ಚಂಪೂ", "D) ವಚನ"],
    "correct_index": 1,
    "explanation": "ಕಾದಂಬರಿ ಗದ್ಯ ಸಾಹಿತ್ಯ ಪ್ರಕಾರಕ್ಕೆ ಸೇರುತ್ತದೆ."
  },
  {
    "id": "kn1-mcq-25",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯದ ನವ್ಯ ಚಳವಳಿ ಯಾವ ದಶಕದಲ್ಲಿ ಬೆಳೆಯಿತು?",
    "options": ["A) 1930ರ ದಶಕ", "B) 1950ರ ದಶಕ", "C) 1970ರ ದಶಕ", "D) 1990ರ ದಶಕ"],
    "correct_index": 1,
    "explanation": "ನವ್ಯ ಚಳವಳಿ 1950ರ ದಶಕದಲ್ಲಿ ಬೆಳೆಯಿತು. ಗೋಪಾಲಕೃಷ್ಣ ಅಡಿಗ, ಲಂಕೇಶ್ ಪ್ರಮುಖ ನವ್ಯ ಲೇಖಕರು."
  },
  {
    "id": "kn1-mcq-26",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಮಹಾಕಾವ್ಯ 'ಗದಾಯುದ್ಧ' ರಚಿಸಿದ ಕವಿ ಯಾರು?",
    "options": ["A) ಪಂಪ", "B) ರನ್ನ", "C) ಪೊನ್ನ", "D) ಜನ್ನ"],
    "correct_index": 1,
    "explanation": "ಗದಾಯುದ್ಧ ಕವಿ ರನ್ನ ರಚಿಸಿದ ಮಹಾಕಾವ್ಯ. ಭಾರತ ಕಥೆಯ ಗದಾಯುದ್ಧ ಪ್ರಸಂಗ ಈ ಕಾವ್ಯದ ವಸ್ತು."
  },
  {
    "id": "kn1-mcq-27",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆ ಸಂವಿಧಾನದ ಯಾವ ಪ್ರಕರಣದ ಅಡಿಯಲ್ಲಿ ಭಾರತದ ಅಧಿಕೃತ ಭಾಷೆಗಳ ಪಟ್ಟಿಯಲ್ಲಿದೆ?",
    "options": ["A) 8ನೇ ಅನುಚ್ಛೇದ", "B) 12ನೇ ಅನುಚ್ಛೇದ", "C) 16ನೇ ಅನುಚ್ಛೇದ", "D) 21ನೇ ಅನುಚ್ಛೇದ"],
    "correct_index": 0,
    "explanation": "ಕನ್ನಡ ಭಾರತ ಸಂವಿಧಾನದ 8ನೇ ಅನುಚ್ಛೇದ (Eighth Schedule) ದಲ್ಲಿ ಸೇರಿದ 22 ಅಧಿಕೃತ ಭಾಷೆಗಳಲ್ಲಿ ಒಂದು."
  },
  {
    "id": "kn1-mcq-28",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಅನುಪ್ರಾಸ ಅಲಂಕಾರದ ವಿಶೇಷತೆ ಯಾವುದು?",
    "options": ["A) ಹೋಲಿಕೆ ಮಾಡುವುದು", "B) ಒಂದೇ ಅಕ್ಷರ ಅಥವಾ ಶಬ್ದ ಪುನರಾವರ್ತನೆ", "C) ವಿರೋಧ ತೋರಿಸುವುದು", "D) ಉತ್ಪ್ರೇಕ್ಷೆ ಮಾಡುವುದು"],
    "correct_index": 1,
    "explanation": "ಅನುಪ್ರಾಸ ಅಲಂಕಾರದಲ್ಲಿ ಒಂದೇ ಅಕ್ಷರ ಅಥವಾ ಶಬ್ದ ಮರುಕಳಿಸಿ ಬಂದು ನಾದ ಸೌಂದರ್ಯ ನೀಡುತ್ತದೆ."
  },
  {
    "id": "kn1-mcq-29",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆಗೆ ಶಾಸ್ತ್ರೀಯ ಭಾಷಾ ಸ್ಥಾನಮಾನ ದೊರೆತ ವರ್ಷ ಯಾವುದು?",
    "options": ["A) 2000", "B) 2004", "C) 2008", "D) 2012"],
    "correct_index": 2,
    "explanation": "ಕನ್ನಡ ಭಾಷೆಗೆ 2008 ರಲ್ಲಿ ಭಾರತ ಸರ್ಕಾರ ಶಾಸ್ತ್ರೀಯ ಭಾಷಾ ಸ್ಥಾನಮಾನ ನೀಡಿತು."
  },
  {
    "id": "kn1-mcq-30",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡದಲ್ಲಿ 'ವಿಭಕ್ತಿ' ಎಂದರೇನು?",
    "options": ["A) ಪದ ರಚನೆ", "B) ನಾಮಪದ ಬದಲಾಗುವ ರೀತಿ", "C) ಕ್ರಿಯಾಪದ", "D) ಅಕ್ಷರ"],
    "correct_index": 1,
    "explanation": "ವಿಭಕ್ತಿ ಎಂದರೆ ನಾಮಪದ ವಾಕ್ಯದಲ್ಲಿ ಇತರ ಪದಗಳೊಂದಿಗೆ ಸಂಬಂಧ ತೋರಿಸಲು ತಳೆಯುವ ರೂಪ ಬದಲಾವಣೆ."
  },
  {
    "id": "kn1-mcq-31",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆ ಮಾತನಾಡುವ ಪ್ರಮುಖ ರಾಜ್ಯ ಯಾವುದು?",
    "options": ["A) ತಮಿಳುನಾಡು", "B) ಆಂಧ್ರ ಪ್ರದೇಶ", "C) ಕರ್ನಾಟಕ", "D) ಕೇರಳ"],
    "correct_index": 2,
    "explanation": "ಕರ್ನಾಟಕ ಕನ್ನಡ ಭಾಷೆ ಮಾತನಾಡುವ ಮುಖ್ಯ ರಾಜ್ಯ. ಕನ್ನಡ ಇಲ್ಲಿನ ಅಧಿಕೃತ ಭಾಷೆ."
  },
  {
    "id": "kn1-mcq-32",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕುವೆಂಪು ಅವರ ಪ್ರಸಿದ್ಧ ಕಾದಂಬರಿ ಯಾವುದು?",
    "options": ["A) ಚೋಮನ ದುಡಿ", "B) ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು", "C) ಮರಳಿ ಮಣ್ಣಿಗೆ", "D) ಕಾನೂರು ಹೆಗ್ಗಡತಿ"],
    "correct_index": 1,
    "explanation": "ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು ಕುವೆಂಪು ಅವರ ಶ್ರೇಷ್ಠ ಕಾದಂಬರಿ. ಮಲೆನಾಡಿನ ಜೀವನ ಇದರ ಹಿನ್ನೆಲೆ."
  },
  {
    "id": "kn1-mcq-33",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಸಮ್ಮೇಳನ (ಅಖಿಲ ಭಾರತ ಕನ್ನಡ ಸಾಹಿತ್ಯ ಸಮ್ಮೇಳನ) ಎಷ್ಟು ವರ್ಷಗಳಿಗೊಮ್ಮೆ ನಡೆಯುತ್ತದೆ?",
    "options": ["A) ಪ್ರತಿ ವರ್ಷ", "B) ಎರಡು ವರ್ಷಕ್ಕೊಮ್ಮೆ", "C) ಐದು ವರ್ಷಕ್ಕೊಮ್ಮೆ", "D) ಹತ್ತು ವರ್ಷಕ್ಕೊಮ್ಮೆ"],
    "correct_index": 0,
    "explanation": "ಅಖಿಲ ಭಾರತ ಕನ್ನಡ ಸಾಹಿತ್ಯ ಸಮ್ಮೇಳನ ಪ್ರತಿ ವರ್ಷ ನಡೆಯುತ್ತದೆ."
  },
  {
    "id": "kn1-mcq-34",
    "difficulty": "easy",
    "marks": 1,
    "question": "'ತ್ರಿಪದಿ' ಎಂದರೇನು?",
    "options": ["A) ಮೂರು ಪಾದಗಳ ಪದ್ಯ ಪ್ರಕಾರ", "B) ಮೂರು ಪ್ರಕರಣಗಳ ನಾಟಕ", "C) ಮೂರು ಅಧ್ಯಾಯಗಳ ಕಾದಂಬರಿ", "D) ಮೂರು ವ್ಯಕ್ತಿಗಳ ಸಂಭಾಷಣೆ"],
    "correct_index": 0,
    "explanation": "ತ್ರಿಪದಿ ಮೂರು ಪಾದಗಳ ಕನ್ನಡ ಪದ್ಯ ಪ್ರಕಾರ. ಸರ್ವಜ್ಞ ಮತ್ತಿತರ ಕವಿಗಳ ತ್ರಿಪದಿಗಳು ಪ್ರಸಿದ್ಧ."
  },
  {
    "id": "kn1-mcq-35",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ದಲಿತ ಸಾಹಿತ್ಯ ಚಳವಳಿ ಯಾವ ದಶಕದಲ್ಲಿ ಬಲವಾಯಿತು?",
    "options": ["A) 1950ರ ದಶಕ", "B) 1960ರ ದಶಕ", "C) 1970ರ ದಶಕ", "D) 1980ರ ದಶಕ"],
    "correct_index": 2,
    "explanation": "ಕನ್ನಡ ದಲಿತ ಸಾಹಿತ್ಯ 1970ರ ದಶಕದಲ್ಲಿ ಪ್ರಬಲವಾಯಿತು. ದೇವನೂರ ಮಹಾದೇವ, ಸಿದ್ಧಲಿಂಗಯ್ಯ ಪ್ರಮುಖ ದಲಿತ ಲೇಖಕರು."
  },
  {
    "id": "kn1-mcq-36",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಪರಿಷತ್ ನ ಮೊದಲ ಅಧ್ಯಕ್ಷರು ಯಾರು?",
    "options": ["A) ಎಚ್.ವಿ.ನಂಜುಂಡಯ್ಯ", "B) ಬಿ.ಎಂ.ಶ್ರೀ", "C) ಕುವೆಂಪು", "D) ಸಿ.ಎಫ್.ಆಂಡ್ರ್ಯೂಸ್"],
    "correct_index": 0,
    "explanation": "ಹೆಚ್.ವಿ.ನಂಜುಂಡಯ್ಯ 1915ರಲ್ಲಿ ಸ್ಥಾಪಿತ ಕನ್ನಡ ಸಾಹಿತ್ಯ ಪರಿಷತ್ ನ ಮೊದಲ ಅಧ್ಯಕ್ಷರು."
  },
  {
    "id": "kn1-mcq-37",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ ದಿನ ಯಾವ ಬಣ್ಣದ ಧ್ವಜ ಹಾರಿಸಲಾಗುತ್ತದೆ?",
    "options": ["A) ಹಳದಿ-ಕೆಂಪು", "B) ಕೆಂಪು-ನೀಲಿ", "C) ಹಳದಿ-ಕೆಂಪು (ಕರ್ನಾಟಕ ಧ್ವಜ)", "D) ಹಸಿರು-ಬಿಳಿ"],
    "correct_index": 2,
    "explanation": "ಕರ್ನಾಟಕ ಧ್ವಜ ಹಳದಿ (ಮೇಲೆ) ಮತ್ತು ಕೆಂಪು (ಕೆಳಗೆ) ಬಣ್ಣಗಳಿಂದ ಕೂಡಿದ್ದು, ರಾಜ್ಯೋತ್ಸವ ಸಮಯದಲ್ಲಿ ಹಾರಿಸಲಾಗುತ್ತದೆ."
  },
  {
    "id": "kn1-mcq-38",
    "difficulty": "medium",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯದ 'ನವೋದಯ' ಚಳವಳಿ ಯಾವ ಅವಧಿಗೆ ಸೇರಿದ್ದು?",
    "options": ["A) 1880-1920", "B) 1920-1950", "C) 1950-1975", "D) 1975-2000"],
    "correct_index": 1,
    "explanation": "ನವೋದಯ ಸಾಹಿತ್ಯ ಚಳವಳಿ 1920-1950 ಅವಧಿಯದ್ದು. ಕುವೆಂಪು, ಬೇಂದ್ರೆ, ಮಾಸ್ತಿ ಪ್ರಮುಖ ನವೋದಯ ಲೇಖಕರು."
  },
  {
    "id": "kn1-mcq-39",
    "difficulty": "hard",
    "marks": 1,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಪ್ರಕಾರ 'ಶತಕ' ಎಂದರೇನು?",
    "options": ["A) 10 ಪದ್ಯಗಳ ಸಂಗ್ರಹ", "B) 100 ಪದ್ಯಗಳ ಸಂಗ್ರಹ", "C) 1000 ಪದ್ಯಗಳ ಸಂಗ್ರಹ", "D) 50 ಪದ್ಯಗಳ ಸಂಗ್ರಹ"],
    "correct_index": 1,
    "explanation": "ಶತಕ ಎಂದರೆ ಒಂದು ನಿರ್ದಿಷ್ಟ ವಿಷಯ ಅಥವಾ ದೇವರ ಕುರಿತು ರಚಿಸಿದ ಸುಮಾರು 100 ಪದ್ಯಗಳ ಸಂಗ್ರಹ."
  },
  {
    "id": "kn1-mcq-40",
    "difficulty": "easy",
    "marks": 1,
    "question": "ಕನ್ನಡ ಭಾಷೆ ಯಾವ ದೇಶದ ಭಾಷೆ?",
    "options": ["A) ಶ್ರೀಲಂಕಾ", "B) ಭಾರತ", "C) ಬಾಂಗ್ಲಾದೇಶ", "D) ಪಾಕಿಸ್ತಾನ"],
    "correct_index": 1,
    "explanation": "ಕನ್ನಡ ಭಾರತ ದೇಶದ ಕರ್ನಾಟಕ ರಾಜ್ಯದ ಅಧಿಕೃತ ಭಾಷೆ."
  }
]
$questions$::jsonb, 15
  FROM ch1
  ON CONFLICT (chapter_id, type) DO NOTHING
),

-- ── Written paper for Chapter 1 ───────────────────────────────────────────────
written_paper AS (
  INSERT INTO public.question_papers (chapter_id, type, questions, total_marks)
  SELECT id, 'written', $wq$
[
  {
    "id": "kn1-wr-01",
    "section": "A",
    "marks": 2,
    "question": "ಕನ್ನಡ ಭಾಷೆಗೆ ಎಷ್ಟು ವರ್ಷಗಳ ಇತಿಹಾಸ ಇದೆ? ಕನ್ನಡ ಭಾಷೆಯ ಮೊದಲ ಲಭ್ಯ ಗ್ರಂಥ ಯಾವುದು?",
    "expected_answer": "Kannada language has approximately 2,500 years of history. The first available Kannada text is Kavirajamarga (ಕವಿರಾಜ ಮಾರ್ಗ), from the 9th century.",
    "marking_scheme": "1 mark for mentioning 2,500 years history; 1 mark for naming Kavirajamarga as the first available Kannada text"
  },
  {
    "id": "kn1-wr-02",
    "section": "A",
    "marks": 2,
    "question": "ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಎಷ್ಟು ಸ್ವರಗಳು ಮತ್ತು ವ್ಯಂಜನಗಳಿವೆ? ಮೂರು ಸ್ವರಗಳ ಹೆಸರು ಬರೆಯಿರಿ.",
    "expected_answer": "Kannada script has 13 vowels (ಸ್ವರ) and 34 consonants (ವ್ಯಂಜನ). Three vowels: ಅ (a), ಆ (aa), ಇ (i) — or any three from the 13.",
    "marking_scheme": "1 mark for correctly stating 13 vowels and 34 consonants; 1 mark for naming any three correct vowels in Kannada script"
  },
  {
    "id": "kn1-wr-03",
    "section": "A",
    "marks": 2,
    "question": "ಸಂಧಿ ಎಂದರೇನು? ಒಂದು ಉದಾಹರಣೆ ನೀಡಿ.",
    "expected_answer": "Sandhi (ಸಂಧಿ) is the change that occurs when two words or sounds combine. Example: ರವಿ + ಇಂದ್ರ = ರವೀಂದ್ರ (ravi + indra = ravindra).",
    "marking_scheme": "1 mark for correct definition of Sandhi; 1 mark for a valid Kannada example of Sandhi"
  },
  {
    "id": "kn1-wr-04",
    "section": "B",
    "marks": 4,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯದ ನಾಲ್ಕು ಮಹಾಕವಿಗಳ ಹೆಸರು ಬರೆದು, ಆದಿಕವಿ ಪಂಪ ಅವರ ಎರಡು ಮುಖ್ಯ ಕೃತಿಗಳನ್ನು ಹೆಸರಿಸಿ.",
    "expected_answer": "The four great poets (ನಾಲ್ಕು ಮಹಾಕವಿಗಳು) of Kannada literature are: 1. Pampa (ಪಂಪ), 2. Ranna (ರನ್ನ), 3. Ponna (ಪೊನ್ನ), 4. Janna (ಜನ್ನ). Pampa's two major works: Vikramarjuna Vijaya (ವಿಕ್ರಮಾರ್ಜುನ ವಿಜಯ) and Adipurana (ಆದಿಪುರಾಣ).",
    "marking_scheme": "2 marks for naming all four great poets correctly; 1 mark each for naming Pampa's two works (Vikramarjuna Vijaya and Adipurana)"
  },
  {
    "id": "kn1-wr-05",
    "section": "B",
    "marks": 4,
    "question": "ಕನ್ನಡ ಸಾಹಿತ್ಯದ ಮೂರು ಪ್ರಕಾರಗಳನ್ನು ಹೆಸರಿಸಿ ಮತ್ತು ಅಲಂಕಾರ ಎಂದರೇನು ಎಂದು ಉದಾಹರಣೆ ಸಹಿತ ಬರೆಯಿರಿ.",
    "expected_answer": "Three types of Kannada literature: 1. Gadya (ಗದ್ಯ - Prose), 2. Padya (ಪದ್ಯ - Poetry), 3. Champu (ಚಂಪೂ - Mix of prose and poetry). Alankara (ಅಲಂಕಾರ) refers to figures of speech that beautify poetry. Example: Upama (ಉಪಮೆ) - comparison using 'like' or 'as', e.g., 'ಆತ ಸಿಂಹದಂತೆ ಹೋರಾಡಿದ' (He fought like a lion).",
    "marking_scheme": "2 marks for naming three correct literary forms; 1 mark for definition of Alankara; 1 mark for a correct example of any alankara"
  },
  {
    "id": "kn1-wr-06",
    "section": "C",
    "marks": 5,
    "question": "ಕನ್ನಡ ಭಾಷೆಯ ಮಹತ್ವ ಮತ್ತು ಕನ್ನಡ ಸಾಹಿತ್ಯದ ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ವಿಜೇತರ ಬಗ್ಗೆ ಒಂದು ಪ್ರಬಂಧ ಬರೆಯಿರಿ.",
    "expected_answer": "Essay should cover: 1) Importance of Kannada as one of India's classical languages with 2,500 years of history. 2) Kannada Rajyotsava on November 1 celebrates Karnataka's formation. 3) Jnanapitha award winners: Kuvempu (1968), D.R.Bendre (1974), Shivarama Karanth (1977), Masti Venkatesha Iyengar (1983), V.K.Gokak (1990), U.R.Ananthamurthy (1994), Girish Karnad (1998), Chandrashekhara Kambara (2011), S.L.Bhyrappa (2023). 4) Contribution of Kannada to Indian culture and literature.",
    "marking_scheme": "1 mark for introduction about importance of Kannada; 2 marks for mentioning at least 3 Jnanapitha award winners with their years; 1 mark for discussing Kannada's contribution to Indian culture; 1 mark for conclusion and overall coherence of essay"
  }
]
$wq$::jsonb, 19
  FROM ch1
  ON CONFLICT (chapter_id, type) DO NOTHING
)

SELECT 'Kannada chapter and question papers created successfully' AS result;
