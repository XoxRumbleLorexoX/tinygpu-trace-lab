# Beginner Study Protocol

Status: not run. No participants, timings or learning outcomes are asserted by this document.

Purpose: test the explicit [GOAL.md](../GOAL.md) target that at least four of five GPU beginners complete the introductory lesson within ten minutes and correctly explain the load/add/store sequence without external documentation. This is a small formative check of this build, not a population-wide learning claim.

## Keep Two Outcomes Separate

The **primary gate** is introductory lesson completion plus a correct load/add/store explanation within 600 seconds. The **transfer checks** test rewind, committed state and the changed-input explanation required by roadmap stage 1. Run transfer checks after freezing the primary outcome; do not silently add them to, or remove explanation from, the four-of-five rule.

A correct prediction or the app's **Lesson complete** state alone does not establish understanding. Conversely, an initially wrong prediction is not an automatic failure: record it and allow the learner to use the application to revise it.

## Recruit And Identify A Cohort

Use five people who report no prior understanding of GPU execution and have not previously completed this lesson. General programming experience is allowed; record it in broad terms so the sample is interpretable. Do not recruit only people who already know the intended answer.

Use anonymous IDs P01-P05. Explain that the interface, not the person, is being evaluated; participation may stop at any time. Record only observations needed for this task. Screen/audio recording is optional and requires the participant's agreement; do not collect names, email addresses or unrelated screen contents in repository records. Keep raw notes private unless sharing is explicitly agreed.

Use the first five eligible, valid sessions on the same build for the primary calculation. Retain failed sessions; do not replace them with successful volunteers. Product bugs, confusing wording and slow application behavior count as product failures, not exclusions. An unrelated interruption, loss of the agreed build or withdrawal can invalidate a session; record the reason, preserve the invalidation count, and recruit a replacement without hiding it. Missing sessions leave the gate pending.

## Prepare A Fixed Build

1. Record the tested URL, source/build identifier, browser version, OS, viewport and input method in a [session record](beginner-study-session.md). Prefer a fixed production preview over a changing development build. If no commit exists, retain a source/build snapshot and its fingerprint; do not use the package version alone as a unique identifier.
2. Use the same tested build for the whole cohort. Pause sessions if implementation changes; start a separately identified cohort afterward. Record desktop/mobile conditions without inferring that success on one proves the other.
3. Open a fresh tab or reload before each participant. Confirm **Learning lab**, **Follow a sum**, 2D view, SIMT, lane width 4, initial trace position, playback paused, no accepted prediction and no completed lesson.
4. Confirm A = `[2, 5, 3, 7]`, B = `[4, 1, 6, 2]`, and unwritten C outputs. Do not run to the answer on the participant's screen during setup. Close external tutorial, source-code and documentation tabs.
5. Respect the participant's motion/accessibility preferences. Record them; do not disable assistive technology to standardize the sample. Prepare a separate stopwatch and a blank record. The facilitator's scoring key must remain out of view.

The following existing commands prepare and serve a production build; use a free port and record the actual URL. They are facilitator setup, not participant tasks.

```bash
npm run build
npm --workspace web run preview -- --port 5176 --strictPort
```

Do not run a second server on an occupied port or deploy publicly merely to conduct a local study.

## Participant Task Card

Read this before starting the timer. Show only this section to the participant, not the scoring key or technical checklist.

> Use this laboratory to complete the introductory lesson. First predict its first output, then inspect how that result is produced. You may use any explanations inside the application. When you are ready, show the completed lesson and explain, in your own words, what the loads, addition and store did, where their values came from, and where the answer went. You have ten minutes. Thinking aloud is welcome, but optional.

Start the timer when the participant begins interacting. Keep the same task wording across sessions.

## Facilitation And Timing

- Allow normal use of the application's text, controls and feedback. Do not provide a tutorial, correct an answer, name the next button, point to the right value, or explain architecture during the primary task.
- Repeating the task card verbatim is allowed. Log every intervention with its time and type: `repeat`, `technical`, or `instructional`. Assistance that reveals a navigation step or answer makes that session assisted, even if the interface is completed.
- Record the first prediction, revisions, confusion, help requests and the times of the load, arithmetic, store and completion observations. Do not require a particular click order if the learner can demonstrate the required behavior.
- Record the explanation verbatim or as a faithful short quotation. Use one neutral prompt if needed: "Please explain how the first output was produced using this example." Log the prompt; do not supply terminology or the answer.
- Stop the primary clock when both lesson completion and the explanation are finished. If either is unfinished at 600 seconds, freeze the outcome as a timed failure. Diagnostic exploration may continue afterward but cannot retroactively turn the primary result into a pass.
- Do not pause the clock for normal loading, confusion or application defects. For unrelated interruptions, record elapsed time and invalidation instead of presenting an adjusted success time.

## Facilitator Scoring Key

Keep this section hidden until the primary result is recorded. Accept plain language; exact register names, address numbers or architectural jargon are not required if the participant correctly identifies the values and destinations on screen.

| Concept | Correct understanding for the default first output                                                                    | Does not count as correct                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Load    | The two input values, 2 and 4, are read from their input memory cells into working registers; loading is not addition | Says loading adds the values, creates the answer or writes C                                             |
| Add     | The loaded 2 and 4 are added to produce 6 in the working computation/register path                                    | Merely repeats "6" without identifying the two operands or operation                                     |
| Store   | The computed 6 is written to the first output memory cell, C[0]; this is distinct from computing it                   | Treats an intermediate arithmetic value as an already written output or says the store performs addition |

Score each concept `2` = correct and independently explained, `1` = partial/ambiguous, `0` = incorrect or absent. A self-correction before the clock stops may earn 2; preserve the initial misconception in the notes. Missing or ambiguous evidence cannot be upgraded to 2 by inference. An observer may review the explanation against the key afterward, but must not add answers the learner never gave.

A valid session is a **primary pass** only when all of the following are true:

- The introductory lesson reaches its observable completion state.
- Load, add and store each score 2.
- Both completion and explanation finish by 600 seconds inclusive.
- No outside documentation or instructional assistance is used.

Do not replace this conjunction with an average score or median time. Record both times as elapsed seconds from first interaction. The combined gate time is the later of completion and explanation, not the sum of their timestamps. Leave it blank when either is unfinished.

## Transfer Checks After The Primary Outcome

1. Ask: "Return to the beginning. Has the first output been written yet? Show what changed." Expected: rewind restores unwritten output state, not the future value 6.
2. Ask: "Change only the first A input to 10. Before running to the end, predict which outputs will change and explain why. Then check your prediction." Expected: C becomes `[14, 6, 9, 9]`; the first thread uses A[0] and B[0], so the other output computations are unchanged.
3. Ask: "At the addition's Execute stage, is the new value already committed to its destination register? Show the difference at Writeback." Expected: R4 is still 0 at Execute, then 6 at Writeback for the default example. Restore defaults before this check; do not score the altered-input value against the default key.

Record each response and whether it required help. These observations address stage 1 and commit-time understanding. They do not change the already frozen stage 2 numerator. Graph, model-comparison and hardware exercises should be separate follow-up sessions or clearly labeled post-task diagnostics, not prep that teaches the primary answer.

## Aggregate Without Inventing Results

Create one session record per actual participant. Leave unobserved fields empty; a blank is not a zero-second completion or a failed participant. Use `pending` until five valid records exist.

| Cohort field                                        | Current result                  |
| --------------------------------------------------- | ------------------------------- |
| Build identifier                                    | Not selected for a human cohort |
| Eligible, valid sessions recorded in this workspace | 0                               |
| Primary passes                                      | Not observed                    |
| Gate result                                         | Pending                         |
| Transfer-check results                              | Not observed                    |

Once five valid sessions exist, count primary passes: four or five passes meets this cohort's target; zero through three does not. Report the denominator, individual outcomes, invalidated sessions, assistance, primary timings and concept scores. Do not claim a population success rate from five participants or merge different builds to reach four passes.

Summarize failures as specific interface observations, not learner deficiencies: for example, "P03 read the Execute result as committed memory; could not locate the historical value." Link each proposed change to the observation, make the scoped fix under a separate implementation request, then run a new cohort for a new claim.

Update [Implementation Status](implementation-status.md) only after actual session records and the calculation support the stated outcome. Passing this study still does not prove all accessibility, mapping or hardware-publication requirements in the [evidence audit](roadmap-evidence.md).
