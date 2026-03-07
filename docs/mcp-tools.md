# MCP Tools

## Task CRUD

### create_task
Create a new task.
- **Required**: title
- **Optional**: summary, description, status, priority, assignee, tags, project_id, parent_task_id, customer, due_date
- **Returns**: the created task

### update_task
Update an existing task.
- **Required**: id
- **Optional**: any task field to update
- **Returns**: the updated task

### list_tasks
List tasks with optional filters.
- **Optional filters**: status, assignee, project_id, tags (array, matches any), customer
- **Returns**: array of tasks

### get_task
Get a task by ID, including its sub-tasks.
- **Required**: id
- **Returns**: task with sub_tasks array

## Project CRUD

### create_project
Create a new project.
- **Required**: name
- **Optional**: description, status, priority, owner, customer
- **Returns**: the created project

### update_project
Update an existing project.
- **Required**: id
- **Optional**: any project field to update
- **Returns**: the updated project

### list_projects
List projects with optional filters.
- **Optional filters**: status, owner, customer
- **Returns**: array of projects

### get_project
Get a project by ID, including task counts by status.
- **Required**: id
- **Returns**: project with task_summary object

## Query

### query
Execute a read-only SQL query against the database.
- **Required**: sql (SELECT only)
- **Returns**: array of result rows

## Context

### get_context
Get recent observations and activity summary. Call this to understand "what's going on" before deciding what to work on.
- **No parameters**
- **Returns**: { observations: [], recent_activity: [] }
