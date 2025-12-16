# Start Code Review Process

Automatically run code review with all enabled reviewers, then guide the user through resolving all findings with expert analysis in a table-based workflow with optional deep-dives.

## Instructions

This command orchestrates the complete code review workflow from start to finish.

### Part 1: Run Automated Reviewers

1. **Clean up any stale metadata and run the review command**

   **First, clean up any stale metadata from previous runs:**
   ```bash
   npx cc-devtools workflow review --cleanup
   ```

   **Then run the review script:**
   ```bash
   npx cc-devtools workflow review
   ```

   The script will automatically:
   - Check for story in `in_review` status (exits if none found)
   - Determine the next round number
   - Get git branch information
   - Build the review prompt
   - Save prompt and metadata to `.tmp/`
   - Run all enabled reviewers in parallel

   Display brief confirmation before running:
   ```
   🤖 Starting automated review with enabled reviewers...
   All reviewers will run in parallel. This typically takes 5-10 minutes.
   ```
   
   **Do not run process in the background**: This should be a blocking execution and the user will need to wait until it completes.

   The script has a 15-minute internal timeout per reviewer and will log collected output if timeout occurs.  You should run the command with a 16-minute timeout (960000ms) in case the internal processing has an error.
   
2. **After completion, check which reviewers succeeded**

   Get the story_id from the script output, then check which reviewers completed:
   ```bash
   npx cc-devtools kanban get-round-reviewers --story={story_id}
   ```

   Parse the JSON output to check which reviewers completed for the current round:
   ```json
   {
     "storyId": "MVP-001",
     "rounds": [
       {
         "round": 2,
         "reviewers": ["claude", "codex"]
       }
     ]
   }
   ```

   Determine which enabled reviewers are missing from the current round's reviewers array.

3. **If any reviewers are missing, offer retry options**

   ```
   📊 Review Status:
   - ✅ Claude: Completed
   - ✅ Codex: Completed
   - ❌ Qwen: Missing

   Qwen did not complete its review. Would you like to:
   A) Retry Qwen
   B) Skip Qwen for now
   ```

   **If user chooses "A" (Retry):**
   - Run the specific reviewer: `npx cc-devtools workflow review qwen` (with 16-minute timeout - 960000ms)
   - After completion, repeat step 2 to check status again
   - Keep looping through steps 2 and 3 until all reviewers complete OR user skips the missing ones

   **If user chooses "B" (Skip):**
   - Remove that reviewer from the missing list
   - If other reviewers are still missing, offer retry for those
   - If no more reviewers to retry, proceed to step 4

4. **Once all reviewers have completed OR been skipped**

   ```
   ✅ Automated review completed!

   Reviews received from: Claude, Codex, Qwen
   [or if some were skipped]
   Reviews received from: Claude, Codex (Qwen skipped)

   Now proceeding to cross-validation and resolution...
   ```

### Part 2: Cross-Validate and Resolve Review Findings

5. **Fetch all reviews for cross-validation analysis**

   Get the review rounds for this story:
   ```bash
   npx cc-devtools kanban get-round-reviewers --story={story_id}
   ```

   For the latest round (the one we just completed):
   - Get the list of reviewers for the latest round
   - For each reviewer in the latest round, fetch their review:
     ```bash
     npx cc-devtools kanban get-review --story={story_id} --round={latest_round} --author={reviewer_name}
     ```
   - Parse each review to identify all issues
   - **Note**: Each reviewer numbers their own issues starting from #1, so issues are identified as "Issue #N"

6. **Perform COMPREHENSIVE PRE-RESEARCH and cross-validation analysis**

   **CRITICAL - This is where ALL research happens BEFORE the Q&A session:**

   You are the expert evaluator. Your role is NOT just to present the reviews - you must do COMPLETE ANALYSIS of EVERY issue BEFORE presenting to the user. The Q&A session (step 8) should be FAST because all research is already done here.

   **DO ALL OF THE FOLLOWING BEFORE PROCEEDING TO STEP 7:**

   a. **Cross-reference all issues and group duplicates**:
      - Identify issues reported by multiple reviewers (high confidence signal)
      - Identify issues reported by only one reviewer (requires deeper validation)
      - Look for conflicts or disagreements between reviewers
      - Group duplicate/similar issues together for combined presentation
      - Build a master list of unique issues to analyze

   b. **For EVERY issue, check if previously rejected**:
      - **BEFORE doing any other research**, search memory for previous rejections:
        * Extract key technical terms from the issue (2-3 most specific terms)
        * Search: `memory_search("review-false-positive {technical terms}")`
      - If found in memory as a previous rejection:
        * **Automatically reject it** - mark as auto-rejected
        * Do NOT include in Q&A session (step 8)
        * Do NOT create new rejection memory
        * Track separately for summary in step 9
      - If NOT previously rejected:
        * Continue with full analysis below

   c. **For EVERY non-rejected issue, check if already tracked in kanban**:
      - Extract key technical terms from the issue (2-3 most specific terms)
      - Search: `npx cc-devtools kanban search "{technical terms}" --limit=5 --similarity-threshold=0.4`
      - **For EVERY result returned (score >= 0.4):**
        * Read the story/subtask details
        * Analyze: Does this existing story/subtask address the same concern?
        * Consider: Same technical area, same files, same underlying issue
        * Make determination: Already Tracked (YES/NO)
      - If YES (already tracked):
        * Mark for Option E (#) with reference to {existing_story_id}
        * Do NOT include in accept/defer decisions
      - If NO (different issue):
        * Continue with full analysis below
      - **Do NOT use score alone to determine tracking status** - scores indicate relevance for LLM review, not automatic classification
      - Save findings for use in step 8

   d. **For EVERY non-rejected issue, read and analyze the actual code**:
      - Use Read tool to examine ALL impacted files mentioned in the review
      - Read surrounding context, not just the specific lines mentioned
      - Look for:
        * Whether the reviewer's claim is accurate
        * If the code already handles the concern
        * TypeScript type safety, null checks, error handling
        * Patterns used elsewhere in the codebase
      - Save your code-level findings for step 8

   e. **For EVERY non-rejected issue, validate junior reviewer findings**:
      - **Qwen is a junior reviewer** - its findings require validation
      - For each junior-reviewer-only issue (found by Qwen only):
        * Compare what they flagged vs what Claude and Codex said (or didn't say)
        * Read the code to verify their claim (completed in step d above)
        * If uncertain, research documentation/best practices (step f below)
        * Make determination: Valid | False Positive | Partially Valid | Stylistic Only
      - For issues where junior reviewers agree with senior reviewers:
        * This confirms the issue - treat as validated
      - For issues where junior reviewers disagree with senior reviewers:
        * Analyze the disagreement
        * Research to determine who is correct
        * Make your expert determination

   f. **For EVERY uncertain issue, research documentation and best practices**:
      - Use `memory_search()` to check project standards and past decisions
      - Use WebSearch to look up:
        * Framework documentation (React, Node.js, TypeScript, etc.)
        * Security best practices
        * Performance considerations
        * Industry standard patterns
      - Check if there are related commands you can run:
        * `npm run typecheck` to verify type safety claims
        * `npm run lint` to check style/pattern concerns
        * `npm run test` if testing concerns raised
      - Save research findings for step 8

   g. **Assess story completion status and issue scope**:

      **CRITICAL - This determines acceptance criteria for issues:**

      a. **Check story completion**:
         - Read the story's acceptance criteria
         - Evaluate: Are ALL acceptance criteria met?
         - Determine story status: Complete | Incomplete | Partially Complete

      b. **For EVERY issue, assess scope**:
         - Question 1: Is this issue **within the original story scope**?
           * Was it required by acceptance criteria?
           * Was it mentioned in story description/details?
           * Is it blocking a stated acceptance criterion?
         - Question 2: Is this issue **scope creep**?
           * Nice-to-have improvement beyond requirements?
           * Production-grade hardening for MVP/setup work?
           * Advanced feature not in original scope?

      c. **Calibrate acceptance bar based on round + completion**:

         **Round 1-2 (Initial Reviews):**
         - Accept: Issues blocking acceptance criteria, critical bugs, security holes
         - Defer: Valid improvements outside original scope
         - Reject: False positives, stylistic concerns

         **Round 3+ (Subsequent Reviews):**
         - Accept ONLY IF:
           * Security vulnerability (data leak, injection, auth bypass)
           * Data corruption risk
           * Application crashes/breaks
           * Acceptance criteria still not met
         - Defer: Everything else that's valid (scope creep, improvements, hardening)
         - Reject: False positives, already addressed, out of scope for story type

         **If Story Acceptance Criteria Are Met:**
         - Accept ONLY IF: Critical security or data corruption
         - Defer: All other valid concerns (even if severity is high)
         - Reject: Anything not critical
         - Rationale: Story is functionally complete - additional work is future enhancement

      d. **For EVERY issue, determine scope classification**:
         - **In Scope**: Required by acceptance criteria, blocks stated goal
         - **Scope Creep**: Valid but beyond requirements (production hardening, nice-to-haves, advanced features)
         - **Story Type Mismatch**: Expecting production standards for setup/infrastructure work

   h. **For EVERY issue, make INITIAL expert determinations WITH CALIBRATION**:
      - **Validity**: Valid | False Positive | Partially Valid | Stylistic Only
      - **Scope**: In Scope | Scope Creep | Story Type Mismatch
      - **Actual Importance**: Critical | High | Moderate | Low | Ignore
      - **Already Tracked Status**: Yes (with story/subtask reference) | No
      - **Reasoning**: Clear explanation based on code analysis, research, cross-validation, AND scope assessment
      - **Initial Recommendation**: A (Accept) | B (Defer) | C (Reject) | D (Already Fixed) | E (Already Tracked)
        * **Decision logic**:
          - Round 3+ AND story acceptance criteria met → Recommend Defer for all non-critical issues
          - Scope Creep issues → Recommend Defer (even if valid and important)
          - In Scope + blocking acceptance criteria → Recommend Accept
          - False Positive OR Story Type Mismatch → Recommend Reject
          - Already Tracked → Recommend Option E
      - **Rationale for recommendation**: Specific reason based on evidence AND round/scope context
      - Save these INITIAL determinations for step 8
      - **NOTE**: These may be adjusted during Q&A if earlier user decisions affect later issues

   i. **Order issues by YOUR determined importance**:
      - Sort the final list: Critical → High → Moderate → Low → Ignore
      - This is the order you'll present in step 8

   **CHECKPOINT**: Before proceeding to step 7, you MUST have:
   - ✅ Identified all previously-rejected issues (auto-reject, exclude from Q&A)
   - ✅ Checked kanban for all remaining issues (analyzed all results, not just scores)
   - ✅ Read code for ALL remaining issues
   - ✅ Validated all junior reviewer findings
   - ✅ Researched uncertain issues
   - ✅ Assessed story completion status and issue scope
   - ✅ Made INITIAL determinations WITH CALIBRATION for ALL issues (may adjust during Q&A)
   - ✅ Ordered issues by importance

   **The Q&A session (step 8) should be FAST** - present findings and get decisions, but stay flexible as decisions cascade.

7. **Present review summary with YOUR analysis**

   **After completing all pre-research in step 6**, display a high-level summary with your evaluation:

   ```
   📋 Review Summary for {STORY-ID}: {Story Title}

   **Current Round**: #{round_number}

   **Reviewers**:
   - Claude: {recommendation} ({total_issues} issues: {critical}C, {high}H, {moderate}M, {low}L)
   - Codex: {recommendation} ({total_issues} issues: {critical}C, {high}H, {moderate}M, {low}L)
   - Qwen: {recommendation} ({total_issues} issues: {critical}C, {high}H, {moderate}M, {low}L) ⚠️ Junior Reviewer
   - Gemini: {recommendation} ({total_issues} issues: {critical}C, {high}H, {moderate}M, {low}L)

   **Cross-Validation Analysis**:
   - Issues confirmed by multiple reviewers: {count}
   - Issues from senior reviewers only: {count}
   - Issues from junior reviewer only (Qwen): {count} (validated)

   **Pre-Research Complete**:
   - ✅ Analyzed code for all issues
   - ✅ Validated junior reviewer findings
   - ✅ Checked memory for previous rejections
   - ✅ Searched kanban for already-tracked issues
   - ✅ Researched documentation where needed

   **My Expert Evaluation** (after analyzing all reviews and code):
   - Story completion status: {Complete | Incomplete | Acceptance criteria met}
   - Current round: #{round} (acceptance bar: {Standard | Strict | Very Strict | Only Critical})
   - Issues auto-rejected (previously rejected): {count}
   - Issues already tracked (Option E): {count}
   - Issues within original scope: {count}
   - Issues that are scope creep: {count}
   - Issues I recommend accepting: {count}
   - Issues I recommend deferring: {count}
   - Issues I recommend rejecting: {count}

   **Context for my recommendations:**
   - This is {a setup story | a feature story | infrastructure work} in {MVP | Beta | Production} phase
   - Round #{round} → {Explanation of acceptance bar for this round}
   - Story acceptance criteria: {Met | Not fully met - {specific criteria still needed}}
   - My recommendation philosophy: {Accept only blocking issues | Defer valid improvements | Reject scope creep for this story type}

   I've completed my analysis. Let's walk through my findings and recommendations for each issue.
   ```

   **Immediately after showing this summary**, move to the next step and present the user with the table summarization and options for how to proceed. **Do not wait for user input**.

8. **Present summary table and handle user interaction (TABLE + SELECTIVE DEEP-DIVE)**

   **CRITICAL - All research is ALREADY COMPLETE from step 6:**
   - Previously-rejected issues were already filtered out in step 6
   - Code has already been read and analyzed
   - Junior reviewer findings already validated
   - Kanban already searched for tracking status
   - Documentation already researched
   - Initial determinations and recommendations already made

   **Your job in this step: Show summary table → Allow selective deep-dives → Apply decisions**

   **Step 8a: Build and display the summary table**

   After completing all pre-research (step 6), present ALL findings in a table format:

   ```
   📋 Review Findings Summary

   Decision | Severity | Story/Issue
   ─────────────────────────────────────────────────────────────────────────────────────────────────
       ✓    |    ⇈     |  1. MVP-001: Missing input validation (claude, codex)
            |          |     No validation on user inputs in authentication endpoints. Creates security
            |          |       vulnerability allowing malformed requests.
            |          |     Accept: Critical security issue that must be fixed before deployment
   ─────────────────────────────────────────────────────────────────────────────────────────────────
       →    |    ⇅     |  2. MVP-001: Inconsistent date formatting (claude)
            |          |     Date formats vary across components. Should standardize for consistency.
            |          |     Defer: Valid improvement but not blocking current story
   ─────────────────────────────────────────────────────────────────────────────────────────────────
       ✗    |    ⇓     |  3. MVP-001: Potential null pointer (qwen)
            |          |     Qwen flagged optional chaining as unsafe but TypeScript handles this correctly.
            |          |     Reject: False positive - optional chaining already handles null cases
   ─────────────────────────────────────────────────────────────────────────────────────────────────
   ```

   **Table format details:**

   **Decision symbols** (based on YOUR recommendation):
   - `✓` = Accept (Fix in current story)
   - `→` = Defer (Create new story for future)
   - `✗` = Reject (False positive)
   - `✓*` = Already Fixed (Resolved during review)
   - `#` = Already Tracked (Existing story/subtask)

   **Severity symbols** (based on YOUR determination):
   - `⇈` = Critical (2 up arrows)
   - `⇑` = High (1 up arrow)
   - `⇅` = Mid (double-sided arrow)
   - `⇓` = Low (down arrow)

   **Story/Issue format**:
   - Line 1: Issue number, Story ID, brief title, (reviewers)
   - Line 2-3: Description of the issue (concise but clear, wrapped/indented)
   - Line 4: Rationale for your recommended action

   **Ordering**: Present issues by YOUR determined importance (Critical → High → Mid → Low)

   After the table, present interaction options:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Options:**
   - Enter a number (1-{N}) to deep-dive into that specific issue
   - Say "proceed" or "confirm" to accept all recommendations as shown

   What would you like to do?
   ```

   **Step 8b: Handle user's choice**

   **If user enters a number (e.g., "3"):**

   Perform a deep-dive Q&A for ONLY that specific issue using this format:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ## Deep Dive: Issue #{N} - {Issue Title}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Reported by**: {List all reviewers who found this, e.g., "Claude, Codex" or "Qwen only"}
   **Cross-validation**: {Multiple reviewers ✓ | Single reviewer ⚠️}
   **Reviewer's stated importance**: {What reviewer(s) said}
   **Effort to resolve**: {What reviewer(s) estimated}

   **Original description:**
   {Combine/summarize descriptions from all reviewers who found this}

   **Impacted files:**
   - {file:line-range}

   ───────────────────────────────────────────────────────────────────────────────────────────────

   **MY EXPERT ANALYSIS:**

   {Present YOUR already-completed evaluation from step 6:
   - The code analysis you already did
   - The cross-validation you already completed
   - The documentation research you already performed
   - The expert determination you already made}

   **Use PAST TENSE** to show research was already completed:
   "I reviewed the code in auth.ts:45-60 and confirmed..."
   "I checked the Express.js security documentation..."
   "I searched our kanban board and found..."

   **MY DETERMINATION:**
   - **Validity**: {Valid | False Positive | Partially Valid | Stylistic Only}
   - **Actual Importance**: {Critical | High | Moderate | Low | Ignore}
   - **Reasoning**: {Clear explanation of your determination}

   ───────────────────────────────────────────────────────────────────────────────────────────────

   **MY RECOMMENDATION:**

   **Choices:**
   A: Accept - Fix this issue in current story {(suggested) - if this is your recommendation}
   B: Defer - Valid but not blocking, create new story for future work {(suggested) - if this is your recommendation}
   C: Reject - False positive, store in memory to prevent future re-reports {(suggested) - if this is your recommendation}
   D: Already Fixed - Issue was valid but resolved during review, no action needed {(suggested) - if this is your recommendation}
   E: Already Tracked - Issue is valid but already tracked in existing story/subtask {(suggested) - if this is your recommendation}

   **I recommend: {A|B|C|D|E}** - {Clear, specific rationale based on your analysis}

   What's your decision?
   ```

   After user responds, handle the decision:

   **If user chooses A (Accept):**
   ```
   ✓ Issue accepted: {Issue Title}
   ```
   Update the in-memory decision for this issue. Track for subtask creation in step 10a.

   **If user chooses B (Defer):**
   ```
   ✓ Issue deferred: {Issue Title}
   ```
   Update the in-memory decision for this issue. Track for story creation in step 10b.

   **If user chooses C (Reject - False Positive):**
   ```
   ✓ Issue rejected as false positive: {Issue Title}
   ```
   Update the in-memory decision for this issue. Will store to memory in step 9.

   **If user chooses D (Already Fixed):**
   ```
   ✓ Issue already fixed: {Issue Title}
   ```
   Update the in-memory decision for this issue. No additional action needed.

   **If user chooses E (Already Tracked):**
   ```
   ✓ Issue already tracked: {Issue Title}
   ```
   Update the in-memory decision for this issue. Will cross-reference in step 10.

   **After recording the decision:**

   **CRITICAL - Check for cascading effects:**
   - Does this decision affect any other issues in the table?
   - Scan through remaining issues and adjust recommendations if needed
   - Update the table with any adjusted recommendations

   **Then return to the table** (go back to step 8a) with updated decisions:

   ```
   ✓ Updated decision for Issue #{N}

   📋 Updated Review Findings Summary

   {Show the updated table with the new decision symbol for issue #N}
   {Show any adjusted recommendations for other issues if cascading occurred}

   **Options:**
   - Enter a number (1-{N}) to deep-dive into another issue
   - Say "proceed" or "confirm" to accept all current recommendations

   What would you like to do?
   ```

   **If user says "proceed" or "confirm":**

   Apply all decisions as currently shown in the table and proceed to Step 9 (Summarize decisions).

   ```
   ✓ Applying all decisions as shown...
   ```

   **Step 8c: Cascading logic (applied during deep-dives)**

   **How ANY decision can cascade to other issues:**

   **A) User ACCEPTS an issue** → Later issues may become Already Fixed (✓*):
   - Track what the accepted fix will address
   - Check if other issues in the table will be fixed by this accepted work
   - Adjust: Change decision from ✓ to ✓* with updated rationale: "This will be addressed by Issue #{N}"

   **B) User DEFERS an issue** → Related issues may also need deferral:
   - Track deferred work scope
   - Check if other issues are better grouped with the deferred work
   - Adjust: Change decision to → with rationale: "Related to deferred Issue #{N}, should be grouped together"

   **C) User REJECTS an issue as false positive** → Similar issues may also be false positives:
   - Track the reasoning for rejection
   - Check if other issues have the same pattern/false positive
   - Adjust: Change decision to ✗ with rationale: "Same false positive as Issue #{N}"

   **D) User says Already Fixed** → Other issues in same area might also be fixed:
   - Track what was fixed and when
   - Check if other issues are in same scope
   - Adjust: Change decision to ✓* if applicable

   **E) User says Already Tracked** → Related issues might be tracked in same story:
   - Track which story is handling this work
   - Check if other issues fall under same scope
   - Adjust: Change decision to # if they're covered by the same story

   **Important notes:**

   - **The table is the source of truth**: All decisions are reflected in the table
   - **Deep-dives are optional**: User only explores issues they're uncertain about
   - **Cascade proactively**: After each decision, check for impacts on other issues
   - **Update table immediately**: Show cascading changes right away
   - **Explain adjustments**: When showing updated table, briefly note: "Issue #5 adjusted to 'Already Fixed' based on your decision on Issue #2"
   - **Be efficient**: Most reviews can be completed by just confirming the table
   - **Present findings, don't research**: All analysis was done in step 6
   - **Use past tense**: "I reviewed...", "I checked...", "I found..."

9. **Process all decisions and summarize**

    After user confirms "proceed" or completes all deep-dives:

    **First, process rejected issues - Store to memory:**

    For EACH issue marked as "Reject" (✗), **IMMEDIATELY store to memory**:
    ```javascript
    memory_store({
      summary: "Review false positive: {brief technical issue title with key terms}",
      details: `**Issue Description**: {what reviewer(s) flagged}
**Why False Positive**: {your detailed expert analysis explaining why it's wrong}
**Reviewers Who Flagged**: {comma-separated list of reviewers}
**Code Location**: {file paths and line ranges examined}
**Technical Context**: {specific TypeScript features, patterns, framework behaviors that make this a false positive}
**Story**: {story_id} Round #{round_number}
**Date**: {ISO date}`,
      tags: ["review-false-positive", "{domain}", "{technology}"]
    })
    ```
    Extract key technical terms for tags (e.g., "typescript", "type-narrowing", "optional-chaining", "database", etc.).

    Display:
    ```
    ✓ Stored {count} false positive(s) to memory to prevent future re-reports
    ```

    **Second, process already-tracked issues - Add cross-references:**

    For EACH issue marked as "Already Tracked" (#), add cross-reference to the existing story:
    ```bash
    npx cc-devtools kanban append-story-field {existing_story_id} planning_notes "Cross-reference from {current_story_id} Round #{round}:
    Issue also identified: {issue description}
    Reported by: {reviewers}
    Validated by: Senior Dev as already being tracked
    Files: {list of files}"
    ```
    Display:
    ```
    ✓ Added cross-references to {count} existing story/stories
    ```

    **Third, present summary of all decisions:**

    ```
    📊 Resolution Summary

    **Issues Accepted** ({count}): Will be fixed
    {List of accepted issues}

    **Issues Deferred** ({count}): Future work
    {List of deferred issues}

    **Issues Rejected** ({count}): False positives (stored to memory)
    {List of rejected issues}

    **Issues Already Fixed** ({count}): Resolved during review
    {List of already-fixed issues}

    **Issues Already Tracked** ({count}): Being tracked in existing stories (cross-referenced)
    {List of already-tracked issues with references to existing stories}

    **Issues Auto-Rejected** ({count}): Previously rejected in past reviews (filtered out before table)
    {Brief list of auto-rejected issue titles}
    ```

10. **Determine final story status and create subtasks/stories**

    Based on the user's decisions, determine the next status and create kanban items in this order:

    **CRITICAL - Order of operations:**
    1. Create subtasks (if accepted issues) - step 10a
    2. Create new stories (if deferred issues) - step 10b
    3. Update story status - step 11
    4. Run workflow script - step 11

    **Decision Logic:**

    - **If any issues were ACCEPTED** → Story will be moved to `in_progress` (in step 11)
      - Reason: There's work to be done, and as a solo developer you're continuing work on this story
      - First proceed to step 10a (offer to create subtasks)

    - **If all issues were REJECTED, DEFERRED, ALREADY FIXED, or ALREADY TRACKED** → Story will be marked as `done` (in step 11)
      - Reason: No work required on current story, review passed
      - If any issues were DEFERRED, proceed to step 10b (create stories for deferred issues)
      - Otherwise, skip to step 11 (update status and run workflow)

10a. **Create subtasks for accepted issues (if any)**

     **IMPORTANT:** Do NOT ask permission - this is part of the automated workflow. The user already decided to accept these issues, so we must create subtasks to track them.

     **CRITICAL:** Create subtasks **ONE AT A TIME** - do NOT batch create them. MCP/CLI tools have issues with large JSON payloads.

     If there are accepted issues, first analyze them for grouping opportunities:

     **Step 1: Analyze and group accepted issues**

     Review all accepted issues and group them logically:
     - Group by component/module (e.g., "authentication module", "cache layer", "API endpoints")
     - Group by impacted files (issues touching the same files)
     - Group by technical area (e.g., "type safety", "error handling", "validation")
     - Group by logical relationship (issues that should be fixed together)

     **Grouping constraints:**
     - Never exceed 8 hours (1 day) total effort per grouped subtask
     - Sum individual effort estimates: High=8h, Moderate=4h, Minimal=2h
     - If grouping would exceed 8 hours, split into multiple subtasks
     - Critical issues can be grouped with other issues in the same area
     - Preserve traceability: List all original issue references in planning_notes

     **Example grouping logic:**
     - 3 issues in authentication module (2 Moderate + 1 Minimal = 10h) → Split into 2 subtasks
     - 2 issues in cache layer (1 High + 1 Moderate = 12h) → Split into 2 subtasks
     - 3 issues in validation logic (3 Minimal = 6h) → Group into 1 subtask
     - 2 unrelated issues (1 High + 1 Moderate = 12h) → Keep as 2 separate subtasks

     **Step 2: Create grouped subtasks**

     For EACH grouped subtask (may contain 1 or more issues):

     1. Build JSON wrapper with ONE subtask:
        ```json
        {
          "subtasks": [
            {
              "title": "Fix: {Descriptive title covering all grouped issues, e.g., 'Authentication Module Issues' or 'Type Safety in Cache Layer'}",
              "description": "{Combined description summarizing all issues in this group}\n\n**Issues Addressed:**\n{For each issue: - Issue #{N}: {Brief title}}",
              "details": "**Issue #1: {Title}**\n{Description and resolution}\n\n**Issue #2: {Title}**\n{Description and resolution}\n\n{Repeat for all grouped issues}\n\n**Impacted files:**\n{Combined list of all files from all issues}",
              "effort_estimation_hours": {Sum of individual efforts, max 8},
              "acceptance_criteria": [
                "All grouped issues resolved as per review feedback",
                {For each issue: "Issue #{N} - {Brief acceptance criterion}"},
                "Code passes all checks (lint, typecheck, test)"
              ],
              "planning_notes": "Grouped subtask combining {count} related issues from Round #{round}\n\n{For each issue:\nOriginal Issue #{N} - Reported by: {Reviewer(s)}, Importance: {Critical|High|Moderate|Low}}"
            }
          ]
        }
        ```

     2. Execute the command for THIS subtask ONLY:
        ```bash
        npx cc-devtools kanban create-subtasks {story_id} '{json}'
        ```

     3. Wait for the command to complete and capture the subtask_id

     4. Repeat for the next grouped subtask

     Display result after ALL subtasks are created:
     ```
     ✅ Created {subtask_count} subtasks for {accepted_count} accepted issues

     {For each subtask created:}
     - {subtask_id}: {title}
       {If grouped: → Addresses {N} issues: {list issue numbers}}
     ```

     Then proceed to step 10b (if deferred issues exist) or step 11 (update status and workflow).

10b. **Create stories for deferred issues (if any issues were deferred)**

     If any issues were marked as "Defer" during resolution, check for duplicate stories before creating new ones.

     **IMPORTANT:** Do NOT ask permission for the automated workflow steps. The user already decided to defer these issues, so we must track them.

     **For each deferred issue, perform duplicate detection:**

     a. **Search for similar existing stories** using semantic search:
        ```bash
        npx cc-devtools kanban search "{issue title and key terms}" --limit=5 --similarity-threshold=0.4 --scope=stories
        ```

        Extract key terms from the issue title and description for the search query (e.g., "error handling authentication", "cache invalidation logic").

     b. **Evaluate search results** for potential duplicates:
        - High confidence match: score >= 0.8 (strong similarity)
        - Medium confidence match: score >= 0.6 (possible duplicate)
        - Low confidence: score < 0.6 (likely different issue)

     c. **Handle high-confidence matches (score >= 0.8):**

        If a high-confidence match is found, present it to the user:
        ```
        🔍 Duplicate Detection for: {Issue Title}

        Found similar existing story:
        - {story_id}: {story_title}
        - Similarity score: {score} (high confidence)
        - Status: {status}

        This appears to be tracking the same or very similar work.

        **Choices:**
        A: Link to existing story - Add note to {story_id} referencing this deferral
        B: Create new story - This is different enough to track separately

        **I recommend: A** - High similarity suggests this is already tracked

        What would you prefer?
        ```

        **If user chooses A (Link to existing):**
        - Append to the existing story's planning_notes:
          ```bash
          npx cc-devtools kanban append-story-field {existing_story_id} planning_notes "Additional context from {current_story_id} Round #{round}:
          {Issue description}
          Reported by: {reviewers}
          Validated by: Senior Dev as valid but not blocking
          Files: {list of files}"
          ```
        - Display confirmation:
          ```
          ✓ Linked to existing story {story_id}
          ```
        - Skip creating new story for this issue

        **If user chooses B (Create new):**
        - Proceed to create new story (continue to step d below)

     d. **Handle medium-confidence matches (0.6 <= score < 0.8):**

        Present the potential duplicate with less confidence:
        ```
        🔍 Possible Duplicate for: {Issue Title}

        Found potentially similar story:
        - {story_id}: {story_title}
        - Similarity score: {score} (possible match)
        - Status: {status}

        This might be related, but the similarity is not as strong.

        **Choices:**
        A: Link to existing story - Add note to {story_id} referencing this deferral
        B: Create new story - Track separately

        **I recommend: B** - Medium similarity suggests this is different enough to warrant separate tracking

        What would you prefer?
        ```

        Handle user choice same as step c.

     e. **Handle low-confidence or no matches (score < 0.6):**

        No duplicate detected - proceed directly to create new story (no user prompt needed).

     **After duplicate detection for all deferred issues:**

     **CRITICAL:** Create stories **ONE AT A TIME** - do NOT batch create them. MCP/CLI tools have issues with large JSON payloads.

     **Step 1: Analyze and group deferred issues that need new stories**

     Before creating stories, analyze deferred issues (that weren't linked to existing stories) for grouping opportunities:
     - Group by component/module (e.g., "authentication improvements", "caching enhancements")
     - Group by impacted files (issues touching the same files)
     - Group by technical area (e.g., "performance optimizations", "error handling improvements")
     - Group by logical relationship (issues that should be implemented together)

     **Grouping constraints for deferred stories:**
     - Group logically related issues together regardless of total effort
     - Sum individual effort estimates: High=16h, Moderate=8h, Minimal=4h
     - Preserve traceability: List all original issue references in planning_notes

     **Example grouping logic for deferred issues:**
     - 3 issues for authentication improvements (1 High + 1 Moderate + 1 Minimal = 32h) → Group into 1 story
     - 3 issues for cache enhancements (3 Minimal = 12h) → Group into 1 story
     - 2 issues for error handling (2 Minimal = 8h) → Group into 1 story
     - 2 unrelated issues → Keep as 2 separate stories

     **Step 2: Create grouped stories for deferred issues**

     For each grouped deferred story (may contain 1 or more issues):

     1. Determine the phase from the current story:
        - Extract current story_id (e.g., "MVP-001", "BETA-005")
        - Parse the phase prefix (MVP, BETA, etc.)
        - Use the same phase for the new deferred story

     2. Build JSON wrapper with ONE story:
        ```json
        {
          "stories": [
            {
              "title": "Deferred from {original_story_id}: {Descriptive title covering all grouped issues, e.g., 'Authentication Improvements' or 'Cache Layer Enhancements'}",
              "description": "{Combined description summarizing all issues in this group}\n\n**Issues Addressed:**\n{For each issue: - Issue #{N}: {Brief title}}",
              "details": "**Original Context:**\nThese issues were identified during code review of {original_story_id} and deferred for future work.\n\n**Issue #1: {Title}**\n**Review Findings:** {Description and rationale}\n**Expert Analysis:** {Your analysis}\n**Suggested Resolution:** {Resolution suggestions}\n**Impacted Files:** {List of files}\n\n**Issue #2: {Title}**\n{Repeat format for each grouped issue}\n\n**Combined Impacted Files:**\n{Deduplicated list of all files from all issues}",
              "phase": "{SAME_PHASE_AS_CURRENT_STORY}",
              "priority": "medium",
              "effort_estimation_hours": {Sum of individual efforts from all grouped issues},
              "planning_notes": "Grouped story combining {count} related deferred issues from {original_story_id} - Round #{round_number}\n\n{For each issue:\nOriginal Issue #{N} - Reported by: {Reviewer(s)}, Validated by: Senior Dev as valid but not blocking}"
            }
          ]
        }
        ```

     3. Execute the command for THIS story ONLY:
        ```bash
        npx cc-devtools kanban create-stories '{json}'
        ```

     4. Wait for the command to complete and capture the new_story_id

     5. Repeat for the next grouped deferred story

     **Effort estimation mapping for deferred stories:**
     - High effort → 16 hours (2 days) - deferred issues often need more investigation
     - Moderate effort → 8 hours (1 day)
     - Minimal effort → 4 hours (half day)
     - **Grouped stories:** Sum individual efforts from all grouped issues (no maximum limit)

     Display results accounting for both newly created and linked stories:
     ```
     📝 Deferred Issues Processed ({total_deferred_count}):

     {If any NEW stories were created:}
     **Created {new_story_count} new stories for {new_issue_count} deferred issues:**
     {For each story created:}
     - {new_story_id}: {title}
       {If grouped: → Addresses {N} issues: {list issue numbers}}

     {If any stories were linked to existing:}
     **Linked to {linked_count} existing stories:**
     {For each linked issue:}
     - {existing_story_id}: {issue_title} (added context note)

     {If new stories created:}
     New stories are in {PHASE} phase with status 'todo' and can be prioritized in future sprints.

     {If stories linked:}
     Linked stories have been updated with additional context from this review.
     ```

     Then proceed to step 11 (update status and run workflow).

11. **Update story status, clean up metadata, inform user, and trigger workflow**

    **CRITICAL - Perform these steps in this exact order:**

    a. Update the story status using the MCP method:
    ```javascript
    kanban_update_work_item({
      item_id: "{story_id}",
      status: "{in_progress|done}",
      implementation_notes: "{Brief summary of review outcome and actions taken}"
    })
    ```
    (Use the status determined in step 10 based on user's decisions)

    **Example implementation_notes:**
    - If accepted issues: "Review Round #{round} completed. {count} issues accepted and converted to subtasks. {count} issues deferred. {count} issues rejected."
    - If all resolved/deferred: "Review Round #{round} passed. {count} issues deferred to future work. {count} false positives rejected and stored in memory. {count} issues already tracked."

    **Important:** Don't ask permission for this update - it's part of the workflow.

    b. Clean up review metadata files:
    ```bash
    npx cc-devtools workflow review --cleanup
    ```

    c. **IMMEDIATELY run the workflow script:**
    ```bash
    npx cc-devtools workflow check
    ```
    This ensures the workflow system detects the status change and suggests next steps.

    **Important:** Don't ask permission - automatically run the workflow after status update.

    d. Display appropriate message based on the outcome:

    **If story moved to IN_PROGRESS (accepted issues):**
    ```
    ✅ Review Resolution Complete

    Story {STORY-ID} status: in_progress

    {accepted_count} issues accepted for fixing.
    {If subtasks created: Created {subtask_count} subtasks}

    The workflow system will guide your next steps.
    ```

    **If story marked as DONE (all issues resolved/deferred/rejected):**
    ```
    ✅ Review Resolution Complete

    Story {STORY-ID} status: done

    🎉 Review passed! All issues have been resolved, deferred, or rejected.

    Summary:
    - {rejected_count} issues rejected
    - {deferred_count} issues deferred to future work
    - {already_fixed_count} issues already fixed
    - {already_tracked_count} issues already tracked in existing stories

    {If deferred_count > 0:}
    📝 Deferred Issues Tracked:
    {If new stories were created:}
    Created {new_stories_count} new stories in {PHASE} phase:
    {List each new story: - {new_story_id}: {title}}

    {If stories were linked:}
    Linked to {linked_stories_count} existing stories:
    {List each linked: - {existing_story_id}: {issue_title}}

    {If already_tracked_count > 0:}
    📎 Already Tracked Issues Cross-Referenced:
    {List each: - {existing_story_id}: {issue_title}}

    The workflow system will guide your next steps.
    ```

## Notes

- **Fully automated workflow**: Runs all enabled reviewers automatically (configured in cc-devtools/workflow/reviewers.yaml)
- **End-to-end process**: Generates prompts → Runs reviewers → **PRE-RESEARCH** → Cross-validates findings → Table-based decision making with optional deep-dives → Updates kanban
- **Comprehensive pre-research (Step 6 - BEFORE presenting table)**:
  - **ALL research happens BEFORE presenting the table** to make decision-making fast
  - For EVERY issue: Read code, validate claims, check memory for previous rejections, search kanban for tracking status
  - Research documentation, run verification commands, cross-validate findings
  - Make INITIAL determinations (validity, importance, recommendation) before presenting
  - Filter out previously-rejected issues automatically
  - Order issues by determined importance
  - **Determinations may adjust during deep-dives** based on cascading effects of earlier user decisions
- **YOU are the expert evaluator**:
  - Do NOT just present reviewer feedback and ask user to decide
  - YOU must analyze all reviews, cross-validate findings, read code, research, and make expert determinations
  - **Do ALL analysis in step 6, present findings in step 8**
  - Validate junior reviewer findings (Qwen) by reading the actual code and researching documentation
  - Be honest when any reviewer is wrong - say so clearly with evidence
  - Sometimes a single reviewer catches something others missed - validate independently
- **Cross-validation is critical**:
  - Multiple reviewers agreeing = high confidence signal
  - Single reviewer (especially junior reviewer Qwen) = requires YOUR validation
  - Read the actual impacted code files before making determinations (in step 6)
  - Use memory_search() to check project standards and past decisions (in step 6)
  - Use WebSearch for best practices, security concerns, framework documentation (in step 6)
- **Junior reviewer handling**:
  - Qwen is a junior reviewer - its findings require validation
  - For junior-reviewer-only issues: Read code, compare to what senior reviewers said/didn't say, determine validity (in step 6)
  - Clearly state when junior reviewer findings are: Valid | False Positive | Stylistic Only | Minor
  - Give credit when junior reviewers catch valid issues others missed
  - Confidently reject junior reviewer findings that are incorrect, with clear explanation
- **Table-based workflow with selective deep-dives (Step 8 - AFTER research)**:
  - Present ALL findings in a summary table format (Decision | Severity | Story/Issue)
  - Show YOUR initial recommendations for all issues upfront
  - User can either:
    - Enter a number to deep-dive into a specific issue (Q&A for just that one)
    - Say "proceed" or "confirm" to accept all recommendations as shown
  - **Deep-dive Q&A (optional, per-issue)**:
    - Present issue with cross-validation context
    - Show YOUR expert analysis (what you ALREADY found in step 6)
    - State YOUR determination (validity, actual importance, reasoning) - already decided
    - Recommend a specific action (A/B/C/D/E) with clear rationale
    - Get user's decision, then return to updated table
  - **Track ALL user decisions and adjust subsequent recommendations dynamically**:
    - Accept → later issues may become Already Fixed (✓)
    - Defer → related issues may need grouped deferral (→)
    - Reject → similar issues may have same false positive (✗)
    - Already Fixed → other issues in same area may also be fixed (✓*)
    - Already Tracked → related issues may be in same story (#)
  - **Update table after each decision**: Show cascading changes immediately
  - Call out adjustments proactively: "Issue #5 adjusted to 'Already Fixed' based on your decision on Issue #2"
  - **Efficient workflow**: Most reviews can be completed by just confirming the table
  - **Do NOT do new research during Q&A** - just present findings and get decisions
  - Use past tense: "I reviewed...", "I checked...", "I found..."
- **Round number detection**: Uses `get-round-reviewers` CLI command to determine next round
- **File-based workflow**: ALL reviewers write to `.tmp/{reviewer-name}-review.txt` files
- The `npx cc-devtools workflow review` command reads these files and stores them to reviews.yaml
- **Status management**: Reviewers do NOT change story status - it stays `in_review`
- **Multiple reviewers supported**: All enabled reviewers run in parallel (configured in cc-devtools/workflow/reviewers.yaml)
- **Independent reviews**: Each reviewer performs their review WITHOUT access to existing reviews - duplicates are expected and valuable
- **Per-reviewer issue numbering**: Each reviewer numbers their own issues starting from #1
- **Multiple rounds supported**: After fixes, run again - this command detects completed rounds and starts a new one
- **Automatic status updates**:
  - Any accepted issues → Story moves to `in_progress` (solo developer continues work)
  - All rejected/deferred/fixed → Story moves to `done`
- **Automatic subtask creation with intelligent grouping**: Creates subtasks for accepted issues
  - **Groups related issues logically** into consolidated subtasks to reduce task fragmentation
  - Grouping by: component/module, impacted files, technical area, or logical relationship
  - **8-hour (1 day) maximum per subtask**: Never exceeds single day of work
  - Preserves full traceability: All original issue references included in planning_notes
  - Effort calculated by summing individual estimates (High=8h, Moderate=4h, Minimal=2h)
  - Example: 3 validation issues (3 Minimal = 6h) → 1 grouped subtask "Fix: Validation Issues"
  - Example: 2 auth issues (1 High + 1 Moderate = 12h) → 2 separate subtasks (exceeds 8h limit)
- **Automatic story creation for deferred issues with intelligent grouping**:
  - When issues are deferred, new stories are automatically created (no permission needed)
  - **Groups related deferred issues logically** into consolidated stories
  - Grouping by: component/module, impacted files, technical area, or logical relationship
  - **No time limit for stories**: Groups all related issues regardless of total effort
  - Stories are created in the same phase as current story (MVP, BETA, etc.)
  - Status defaults to `todo`
  - Full context preserved: review findings, expert analysis, impacted files
  - Reference to original story included in planning_notes
  - Prevents deferred issues from being lost
  - Example: 3 auth improvements (1 High + 1 Moderate + 1 Minimal = 32h) → 1 grouped story "Authentication Improvements"
- **Semantic duplicate detection for deferred issues**:
  - Before creating deferred stories, automatically searches for similar existing stories using hybrid keyword + semantic search
  - High confidence match (score >= 0.8): Recommends linking to existing story instead of creating duplicate
  - Medium confidence match (score >= 0.6): Presents as possible duplicate with recommendation to create new
  - Low confidence (score < 0.6): Automatically creates new story without user prompt
  - Linking to existing story appends context to planning_notes instead of creating duplicate
  - Prevents duplicate story proliferation while maintaining complete context
  - Uses same semantic search that powers `npx cc-devtools kanban search` command
- **Kanban checking during cross-validation (Option E: Already Tracked)**:
  - During cross-validation analysis (step 6c), LLM searches kanban to check if issue is already tracked
  - Search uses semantic search with similarity threshold 0.4
  - High confidence match (score >= 0.7): Issue is likely already tracked
  - Medium confidence (0.5-0.7): Potentially related, mentioned in analysis
  - Low confidence (< 0.5): Proceed normally
  - If issue is already tracked, user can choose option E to cross-reference instead of creating duplicate work
  - Cross-reference adds context to existing story's planning_notes
  - Prevents duplicate subtasks/stories for work already in progress or planned
  - Maintains full audit trail of which reviews identified the same issue
- **Group duplicate issues**: If multiple reviewers found the same issue, present as one decision point with cross-validation note
- **Order by YOUR importance**: Present issues ordered by YOUR determined importance (not reviewer's), Critical → High → Moderate → Low → Ignore
- Suggest user run `/workflow-start-review` after fixing issues to start next review round
- Maintains full audit trail of all decisions and YOUR expert analysis
- **IMPORTANT**: Always use `npx cc-devtools kanban` CLI commands
- **Uses review CLI commands**:
  - `get-round-reviewers` to discover which reviewers submitted reviews for each round
  - `get-review` to fetch individual reviews (one at a time, avoiding truncation)
