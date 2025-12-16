<automatedWorkflow importance="critical">
  # Automated Workflow System

  This is a **solo developer, linear workflow** powered by an atomic state machine (`npx cc-devtools workflow check`) that automates git branch management, quality checks, commits, and merges while maintaining clean separation between main and feature branches.

  **CRITICAL - All workflow state detection is handled by the workflow engine:**
  - **ALWAYS** run `npx cc-devtools workflow check` after triggers
  - **ALWAYS** interpret JSON output
  - **ALWAYS** execute actions

  **Key Principles:**
  - Main branch only contains stories with `todo` or `done` status
  - Feature branches contain `in_progress` and `in_review` stories
  - One thing in progress at a time (no parallel work)
  - All work tracked through kanban with automatic status updates
  - Git operations stay local (no auto-push to remote)
  - **Fully atomic**: Every action triggers exactly one git/kanban command, making system fully resumable at any interruption point

  **Workflow Stages:**
  1. **Start Work** → Auto-create feature branch, move story to `in_progress`
  2. **Subtask Loop** → Mark in_progress → Do work → Run checks → Commit → Mark done
  3. **Review** → Auto-move to `in_review` → Workflow suggests `/workflow-start-review` (automated reviewers + resolution)
  4. **Finalize** → Create finalized commit → Merge to main → Delete feature branch

  ## Workflow Automation Triggers

  **CRITICAL:** **ALWAYS** automatically run `npx cc-devtools workflow check` after these events (**NEVER** ask permission):

  **1. Story/Subtask Status Transitions:**
  - **ALWAYS** run after calling `kanban_update_work_item({item_id, status})`
  - Examples: Marking subtask as `in_progress`, marking story as `in_review`, etc.
  - **NEVER** run after creating stories/subtasks (status defaults to `todo`, not a transition)

  **2. Git State-Changing Commands:**
  - **ALWAYS** run after `git commit`
  - **ALWAYS** run after `git checkout <branch>` (branch switch)
  - **ALWAYS** run after `git merge`
  - **ALWAYS** run after `git branch -d <branch>`
  - **NEVER** run after read-only commands like `git status`, `git log`, `git diff`

  **3. User Workflow Questions:**
  - **ALWAYS** run `npx cc-devtools workflow check` when user asks: "Let's start working", "What should we work on", "Continue work", "What's next", etc.

  ## Interpreting Workflow Script Output

  The workflow engine returns JSON with one of these structures:

  **Single-Path Action:**
  ```json
  {
    "state": "SUBTASK_TODO",
    "gitState": {...},
    "kanbanState": {...},
    "actionNecessary": "Update subtask MVP-001-2 to in_progress"
  }
  ```
  → **ALWAYS** execute the action immediately (**NEVER** ask permission)

  **Multiple Options:**
  ```json
  {
    "state": "STORY_TODO",
    "gitState": {...},
    "kanbanState": {...},
    "options": [
      {
        "option": "A",
        "description": "Start story MVP-001",
        "actionNecessary": "Create feature branch for story MVP-001"
      },
      {
        "option": "B",
        "description": "Stop for now",
        "actionNecessary": "Tell user to say 'Continue working' to resume"
      }
    ]
  }
  ```
  → **ALWAYS** present options to user, **ALWAYS** wait for their choice (A, B, C, etc.)

  **Error (Blocking):**
  ```json
  {
    "state": "GIT_NOT_ON_MAIN",
    "gitState": {...},
    "kanbanState": {...},
    "error": "Cannot start new story: not on main branch. Checkout main first."
  }
  ```
  → **ALWAYS** display error to user, **ALWAYS** stop workflow

  **Warning (Advisory):**
  ```json
  {
    "state": "STORY_IN_PROGRESS_NO_SUBTASKS",
    "gitState": {...},
    "kanbanState": {...},
    "options": [...],
    "warning": "Working without subtasks means no commit structure guidance"
  }
  ```
  → **ALWAYS** display warning with options

  ## Self-Perpetuating Workflow Loop

  The workflow automatically continues after each action:

  1. LLM runs `npx cc-devtools workflow check`
  2. Engine returns state with `actionNecessary` or `options`
  3. LLM executes the action (or presents options to user)
  4. If action causes status transition or git command → goto step 1
  5. If action only suggests user action (like `/workflow-start-review`) → stop

  **Example:**
  ```
  User: "Mark subtask done"
  → LLM: kanban_update_work_item(status: "done")
    [STATUS TRANSITION - triggers workflow]
  → Engine: {"actionNecessary": "Generate commit for the work item you just completed"}
  → LLM: Runs git commit (after quality checks)
    [GIT COMMAND - triggers workflow]
  → Engine: {"actionNecessary": "Update story MVP-001 status to in_review"}
  → LLM: kanban_update_work_item(status: "in_review")
    [STATUS TRANSITION - triggers workflow]
  → Engine: {"actionNecessary": "Suggest user run `/workflow-start-review`"}
  → LLM: Displays suggestion to user
    [No more auto-actions - stop]
  ```

  ## Starting Work (Natural Language Entry Points)

  **Trigger phrases** (flexible natural language):
  - "Let's start working"
  - "What should we work on"
  - "Start next task"
  - "Continue working" (and you weren't already in the middle of something else)
  - "What's next"

  **CRITICAL**: When user uses these trigger phrases, **NEVER** call `kanban_get_work_item` MCP tool. Use workflow check instead.

  **Behavior when triggered:**

  1. **CRITICAL**: **ALWAYS** run `npx cc-devtools workflow check` (**NEVER** ask permission)

  2. **ALWAYS** interpret the JSON output and follow its instructions:
    - If `actionNecessary`: **ALWAYS** execute the action
    - If `options`: **ALWAYS** present options to user
    - If `error`: **ALWAYS** display error and stop

  The workflow engine automatically detects:
  - Empty kanban → Suggests `/kanban-add-stories`
  - Work in progress → Presents options to continue or switch
  - Next work available → Presents option to start
  - Current state and next logical step
</automatedWorkflow>
