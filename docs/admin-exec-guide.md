# Admin & Exec Guide

How to run the Projects Health Dashboard: adding projects and members, setting the scoring formulas, and reading the stats.

> **Who can do what**
>
> | Role      | Can access                                                                       |
> | --------- | -------------------------------------------------------------------------------- |
> | **Exec**  | Exec dashboard (read-only, cross-project view)                                   |
> | **Admin** | Everything execs can see, plus projects, members, formulas, and authorised users |
>
> The admin links sit in the top navigation bar and only appear on a desktop-width window.

## Contents

1. [Quick reference](#quick-reference)
2. [Adding a project](#adding-a-project)
3. [Adding members](#adding-members)
4. [Health score formula](#health-score-formula)
5. [Weekly MVP formula](#weekly-mvp-formula)
6. [What each stat means](#what-each-stat-means)

---

## Quick reference

| I want to…                     | Go to                                                             |
| ------------------------------ | ----------------------------------------------------------------- |
| Create a project               | **Admin dashboard** → **New Project**                             |
| Edit a project                 | **Admin dashboard** → click the project → **Edit**                |
| Add one member                 | **Admin dashboard** → click the project → **+ Add member**        |
| Add many members at once       | **Admin dashboard** → click the project → **Add members via CSV** |
| Set the health score formula   | **(Metric Weighting)** in the nav bar → **Health Score** box      |
| Set the MVP formula            | **(Metric Weighting)** in the nav bar → **Weekly MVP** box        |
| Give someone admin/exec access | **(Authorised Users)** in the nav bar                             |
| See all projects at a glance   | **Exec dashboard** in the nav bar                                 |

**When do stats update?** Once a week, every Monday at 00:00 UTC. Each week runs Monday 00:00 → Sunday 23:59 UTC.

---

## Adding a project

### Before you start, have ready

- [ ] Project **name**
- [ ] The **GitHub repo URL(s)**, e.g. `https://github.com/wdcc/my-project`
- [ ] The **Discord channel ID(s)** and channel names ([how to get one](#how-to-get-a-discord-channel-id))
- [ ] _(Optional)_ a short description, start month, and a project image

### Steps

1. Click **Admin dashboard** in the top-right of the nav bar.
2. Click **New Project**.
3. Fill in the form:

   | Field                | Required? | What to enter                                                                                                                     |
   | -------------------- | :-------: | --------------------------------------------------------------------------------------------------------------------------------- |
   | **Project Name**     |    ✅     | Display name, e.g. `WDCC Website 2025`                                                                                            |
   | **Start Date**       |           | Month and year the project started                                                                                                |
   | **Description**      |           | One or two sentences on what the project is and who it's for                                                                      |
   | **Repositories**     |    ✅     | Paste a repo URL in the form `https://github.com/owner/repo` and click **Add**. Repeat for each repo.                             |
   | **Discord Channels** |    ✅     | Enter the **Snowflake ID** (channel ID) _and_ a **name** (e.g. `general`), then click **+ Add Channel**. Repeat for each channel. |
   | **Project Image**    |           | JPG, PNG, or WebP, up to 4 MB                                                                                                     |

4. Click **Create Project**. You'll be sent back to the admin dashboard.

> 💡 Each added repo or channel shows up as a chip under its input. Click the **×** on a chip to remove it.

### How to get a Discord channel ID

Discord hides channel IDs until you turn on Developer Mode. You only need to do this once.

1. In Discord, open **User Settings** (the ⚙️ gear next to your name, bottom-left).
2. Go to **Advanced** (under _App Settings_).
3. Turn on **Developer Mode**.
4. Close settings, **right-click the channel** in the sidebar, and choose **Copy Channel ID**.

A channel ID is a 17–19 digit number, like `1234567890123456789`.

> ⚠️ Only messages in channels the dashboard's Discord bot can see are counted. If a channel is private, make sure the bot has access to it.

---

## Adding members

Members link a person to their GitHub and Discord accounts. That's how commits, PRs, and messages are credited to the right person.

There are two ways to add them:

| Method                                | Best for                        |
| ------------------------------------- | ------------------------------- |
| [One at a time](#add-a-single-member) | Adding one or two people        |
| [CSV upload](#bulk-add-via-csv)       | Setting up a whole team at once |

### Add a single member

1. **Admin dashboard** → click the project's card.
2. Click **+ Add member**.
3. Under **Select person**:
   - **Already in the system?** (e.g. on another project) Pick them from the dropdown. Their name, photo, and accounts are reused, so skip to step 5.
   - **New person?** Leave it on **— Create new person —**.
4. Fill in their details:

   | Field                     | Required? | What to enter                                                                                 |
   | ------------------------- | :-------: | --------------------------------------------------------------------------------------------- |
   | **Display name**          |    ✅     | Their name as it should appear on the dashboard                                               |
   | **Discord username / ID** |           | Their Discord **username** ([how to find it](#finding-someones-github-and-discord-usernames)) |
   | **GitHub username**       |           | Their GitHub **username** ([how to find it](#finding-someones-github-and-discord-usernames))  |
   | **Profile photo**         |           | Image up to 4 MB                                                                              |

5. Tick their role(s) in the project (**Developer** and/or **Designer**).
6. Click **Add Member**. The site checks the usernames with GitHub and Discord before saving, so a typo shows an error rather than adding a broken link.

> ⚠️ Without a GitHub or Discord account linked, that person's activity can't be credited to them, and they won't be eligible for Weekly MVP.

### Finding someone's GitHub and Discord usernames

**GitHub username**

- It's the part after `github.com/` in their profile URL. For `https://github.com/janesmith`, the username is `janesmith`.
- It's also shown in grey under their name on their profile page.

**Discord username**

- Click their name or avatar in the WDCC Discord server. The **username** is the lowercase handle under their display name (e.g. `janesmith`).
- Use the username, **not** the display name or server nickname.
- They must already be a member of the WDCC Discord server.

### Bulk add via CSV

1. **Admin dashboard** → click the project's card.
2. Click **Add members via CSV**.
3. Click the dashed upload box and choose your `.csv` file.
4. Wait for **Upload complete!**. Each row is added one at a time.

#### Required format

The first row must be these exact column headers:

| Column         | Required? | Example                        |
| -------------- | :-------: | ------------------------------ |
| `Name`         |    ✅     | `Jane Smith`                   |
| `Github Name`  |           | `janesmith`                    |
| `Discord Name` |           | `janesmith`                    |
| `Image URL`    |           | `https://example.com/jane.png` |

#### Template

Copy this into a file called `members.csv` and replace the example rows:

```csv
Name,Github Name,Discord Name,Image URL
Jane Smith,janesmith,janesmith,
Alex Lee,alexlee,alex.lee,https://example.com/alex.png
```

> 💡 **Tips**
>
> - Header names are case-sensitive. `Github Name` works, but `GitHub Name` won't.
> - Leave a cell empty if you don't have that info. Only `Name` is required.
> - People already on the project are **skipped**, not duplicated. The uploader lists which rows it skipped.
> - If a row fails (e.g. a GitHub username doesn't exist), the other rows still get added. The error message tells you the row number to fix.

---

## Health score formula

The health score is a single number summarising how active a project was in a week. **You decide how it's calculated.** One formula applies to every project.

### Where to find it

1. Click **(Metric Weighting)** in the nav bar (top-left, next to **(Authorised Users)**).
2. Use the **Health Score** box (the first one).

### Variables you can use

| Variable           | Means                                                  |
| ------------------ | ------------------------------------------------------ |
| `commits`          | Number of commits that week                            |
| `prs`              | Number of pull requests merged that week               |
| `lines_changed`    | Lines added + lines removed across that week's commits |
| `discord_messages` | Messages sent in the project's linked Discord channels |

Click a variable chip to insert it. The input also autocompletes as you type.

### Supported operations

| Type      | Available                                                              |
| --------- | ---------------------------------------------------------------------- |
| Operators | `+` `-` `*` `/` `^` (power), and `( )` for grouping                    |
| Functions | `sqrt()`, `log()`, `min()`, `max()`, and other standard math functions |
| Numbers   | Whole numbers or decimals, e.g. `3` or `0.5`                           |

> ⚠️ Two variables side by side with no operator are **multiplied**: `prs discord_messages` = `prs * discord_messages`.

### Example to get started

```
commits + prs * 3 + lines_changed / 100 + discord_messages / 10
```

This counts each commit as 1 point, each merged PR as 3, every 100 lines changed as 1, and every 10 Discord messages as 1.

> 💡 `lines_changed` can spike when someone commits a large generated file. To soften it, use `sqrt(lines_changed)` or cap it with `min(lines_changed, 2000) / 100`.

### Saving

1. Type your formula. The **preview** shows the result for a sample week (12 commits, 4 PRs, 320 lines changed, 47 Discord messages), so you can sanity-check the weighting.
2. Fix any errors shown. The formula must use only the variables above and must produce a number.
3. Click **Save Formula**.
4. Type **`Change Health Score`** in the confirmation box and click **Confirm**.

> ⚠️ **Saving recalculates every project's health score and velocity for every past week**, not just future weeks. Use **Revert to Saved** to undo unsaved edits.

---

## Weekly MVP formula

The Weekly MVP is the top contributor on each project for the week. The MVP formula gives every member a score, and **the member with the highest score that week is the MVP**.

### Where to find it

1. Click **(Metric Weighting)** in the nav bar.
2. Use the **Weekly MVP** box (the second one).

### Variables and operations

These are the **same variables and operations as the health score** ([see above](#variables-you-can-use)), but here they're counted **per member**, using only that person's own activity:

| Variable           | Means (for one member, one week)                     |
| ------------------ | ---------------------------------------------------- |
| `commits`          | Commits they made                                    |
| `prs`              | Their pull requests that were merged                 |
| `lines_changed`    | Lines they added + removed                           |
| `discord_messages` | Messages they sent in the project's Discord channels |

### Example to get started

```
commits * 2 + prs * 5 + sqrt(lines_changed) + discord_messages / 5
```

This puts the most weight on shipping merged PRs, still rewards steady commits, and stops one huge commit from dominating.

### How the MVP is picked

1. Every member of each project gets a score from the formula.
2. **Highest score wins.**
3. Tie? It goes to whoever added more lines, then whoever made more commits, then alphabetical order by name.

### Saving

Same as the health score: **Save Formula** → type **`Change Weekly MVP`** → **Confirm**. The new formula is used immediately.

---

## What each stat means

All stats cover one week (Monday 00:00 → Sunday 23:59 UTC) and refresh every Monday.

### Activity stats (counted automatically)

| Stat                 | What it means                                                      | How it's found                                                                                                 |
| -------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Commits**          | Number of commits made to the project's repos in the week          | Counted from every GitHub repo linked to the project. Commits made directly on `main`/`master` aren't counted. |
| **Lines changed**    | Total lines added **and** removed across all commits in the week   | `lines added + lines removed`, summed across the same commits as above                                         |
| **Pull requests**    | Number of PRs **merged** in the week                               | PRs in the linked repos whose merge date falls in the week. Open or closed-unmerged PRs don't count.           |
| **Discord messages** | Number of messages sent in the linked Discord channels in the week | Counted by the Discord bot across every channel linked to the project                                          |

### Calculated stats

| Stat             | What it means                                       | How it's found                                                                                                                                         |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Health score** | One number for how active the project was that week | The [health score formula](#health-score-formula) applied to the week's commits, lines changed, PRs, and Discord messages. Blank if no formula is set. |
| **Velocity**     | Is the project speeding up or slowing down?         | % difference between this week's health score and the **average of the previous 4 weeks**. See below.                                                  |
| **Sentiment**    | The team's mood that week                           | AI-scored from the tone of the week's Discord messages and commit messages. See below.                                                                 |
| **Weekly MVP**   | The project's top contributor that week             | The member with the highest score when the [MVP formula](#weekly-mvp-formula) is applied to each member's weekly stats                                 |

### Reading velocity

```
velocity = (this week's health score − average of last 4 weeks) ÷ average of last 4 weeks × 100
```

| Velocity | Means                                   |
| -------- | --------------------------------------- |
| `+25%`   | 25% more active than the recent average |
| `0%`     | Same as usual                           |
| `−40%`   | 40% less active than the recent average |

- **New projects:** if fewer than 4 weeks of history exist, it averages whatever weeks there are. The very first week shows `0%`.
- **Blank velocity** means it couldn't be calculated, e.g. there's no health score, or the previous weeks averaged 0.

### Reading sentiment

Sentiment is a score from **−1.0 to +1.0**, generated by an AI model reading that week's Discord and commit messages. It reflects **tone only**. A quiet week isn't a negative week.

| Score        | Mood                                        |
| ------------ | ------------------------------------------- |
| 0.8 to 1.0   | 🟢 Very positive: excited, celebrating wins |
| 0.5 to 0.7   | 🟢 Positive: engaged, collaborative         |
| 0.0 to 0.4   | ⚪ Neutral to mildly positive               |
| −0.5 to −0.1 | 🟠 Mildly negative: stress, friction        |
| −1.0 to −0.6 | 🔴 Frustrated, blocked, or burnt out        |

- Each score comes with a 1–2 sentence explanation of why it was given.
- **No score?** The project had fewer than 10 commits + Discord messages combined that week, which isn't enough to judge.
