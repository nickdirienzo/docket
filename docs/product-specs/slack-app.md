# Slack App Spec

## What it is

A thin Slack integration that lets people tag `@docket` in any channel to capture
work signals. It reads surrounding context, talks to the Docket API, and responds
intelligently. It is a separate package — Docket core knows nothing about Slack.

## The problem

Work context lives in Slack and evaporates. A CEO reports bugs in a channel. A
customer describes a problem in a shared channel. An engineer flags a production
issue. Today, someone has to read all of that, interpret it, and manually create
tickets. Context degrades at every step. Often it just gets lost.

"I can try to find some time to file tickets after this next call" — that sentence
is the entire problem. The filing step is pure waste. The person already said
everything that matters.

## How it works

1. Someone tags `@docket` in a Slack channel (or thread)
2. The app reads recent messages in that channel/thread for context
3. The app calls Claude with the Slack context + Docket context (via API)
4. Claude decides the right response:

### Response types

**Clear enough to act on** — creates a task in Docket, replies with what it
understood:
> Created: Hybrid scenario builder doesn't generate email after question flow.
> Tagged as bug, linked to 2 similar reports from last week.

**Needs clarification** — asks a follow-up in a thread:
> Is this happening for all hybrid scenarios or just new ones? And is this the
> Intermedia environment?

**Already tracked** — links to existing work:
> This is already on the docket — linked to your report from Tuesday. Adding
> this as additional context.

## Architecture

```
slack-app/          <-- new package in this repo
  src/
    index.ts        <-- Slack event handler (bolt or raw webhook)
    intake.ts       <-- reads channel context, calls Claude + Docket API
```

The app is a Slack bot with:
- Event subscription for `app_mention` events
- Permission to read channel history (for surrounding context)
- Access to Docket worker API (same as MCP server uses)

The Claude call is the only smart part. Everything else is plumbing.

## Channel scope

Not every channel. An allowlist of channels where `@docket` is active:
- Engineering channels
- Project channels
- Production alerts
- Private customer channels

Added by inviting the bot to a channel. If `@docket` isn't in the channel, it
can't see messages there. Slack's existing permission model handles scoping.

## What it doesn't do

- **Watch all messages passively.** v1 is explicit intake only. Someone decides
  "this matters" and tags it. Passive synthesis is a future optimization once
  people trust it.
- **Replace Docket.** The app is a client of the Docket API, same as the MCP
  server. It creates tasks, queries context, and responds. Docket is the brain.
- **Know about Slack internals.** Docket core has no Slack types, no Slack API
  calls, no channel IDs in the database. The Slack app translates between the
  two worlds.

## Future (not v1)

- **Passive watching**: Docket monitors channels and synthesizes without being
  tagged. Requires confidence in noise filtering.
- **Proactive notifications**: Docket posts in Slack when it notices patterns
  ("3 reports about export performance this month, no task exists").
- **Thread follow-ups**: After creating a task, Docket updates the original
  Slack thread when the work ships.
- **Graduation to NonnaClaw skill**: If the use case grows beyond simple intake
  into persistent agent conversations, move it to a NonnaClaw skill with
  container isolation and scoped tools.
