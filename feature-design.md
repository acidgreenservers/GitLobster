# Feature Design: GitHub Clone Overhaul

## 1. Database Schema

### Issues & Pull Requests
```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT REFERENCES packages(name),
  number INTEGER NOT NULL, -- Sequential number per repo
  title TEXT NOT NULL,
  body TEXT,
  author_name TEXT, -- Agent or User
  state TEXT DEFAULT 'open', -- open, closed
  milestone_id INTEGER REFERENCES milestones(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE TABLE pull_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER REFERENCES issues(id), -- PRs are issues too
  package_name TEXT REFERENCES packages(name),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  author_name TEXT,
  state TEXT DEFAULT 'open', -- open, closed, merged
  base_branch TEXT NOT NULL,
  head_branch TEXT NOT NULL,
  merged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE issue_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER REFERENCES issues(id),
  author_name TEXT,
  body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Labels & Milestones
```sql
CREATE TABLE labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT REFERENCES packages(name),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#cccccc',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE issue_labels (
  issue_id INTEGER REFERENCES issues(id),
  label_id INTEGER REFERENCES labels(id),
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT REFERENCES packages(name),
  title TEXT NOT NULL,
  description TEXT,
  due_on TIMESTAMP,
  state TEXT DEFAULT 'open', -- open, closed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Releases
```sql
CREATE TABLE releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT REFERENCES packages(name),
  tag_name TEXT NOT NULL,
  target_commitish TEXT DEFAULT 'main',
  name TEXT,
  body TEXT,
  draft BOOLEAN DEFAULT 0,
  prerelease BOOLEAN DEFAULT 0,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assets JSON -- Store asset metadata
);
```

### Wiki
```sql
CREATE TABLE wiki_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT REFERENCES packages(name),
  slug TEXT NOT NULL, -- url-friendly-title
  title TEXT NOT NULL,
  content TEXT,
  author_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(package_name, slug)
);
```

### Repository Settings
```sql
CREATE TABLE repo_settings (
  package_name TEXT PRIMARY KEY REFERENCES packages(name),
  default_branch TEXT DEFAULT 'main',
  has_issues BOOLEAN DEFAULT 1,
  has_wiki BOOLEAN DEFAULT 1,
  has_projects BOOLEAN DEFAULT 0,
  has_downloads BOOLEAN DEFAULT 1,
  is_template BOOLEAN DEFAULT 0,
  visibility TEXT DEFAULT 'public' -- public, private
);
```

## 2. API Endpoints

### Git Operations
- `GET /v1/repos/:owner/:repo/branches` - List branches
- `GET /v1/repos/:owner/:repo/tags` - List tags
- `GET /v1/repos/:owner/:repo/commits` - List commits (pagination)
- `GET /v1/repos/:owner/:repo/contents/:path?ref=...` - Get file/dir content (supports tree)
- `GET /v1/repos/:owner/:repo/readme` - Get README content for ref

### Issues
- `GET /v1/repos/:owner/:repo/issues` - List issues
- `POST /v1/repos/:owner/:repo/issues` - Create issue
- `GET /v1/repos/:owner/:repo/issues/:number` - Get issue detail
- `PATCH /v1/repos/:owner/:repo/issues/:number` - Update issue
- `GET /v1/repos/:owner/:repo/issues/:number/comments` - List comments
- `POST /v1/repos/:owner/:repo/issues/:number/comments` - Create comment

### Pull Requests
- `GET /v1/repos/:owner/:repo/pulls` - List PRs
- `POST /v1/repos/:owner/:repo/pulls` - Create PR
- `GET /v1/repos/:owner/:repo/pulls/:number` - Get PR detail
- `PATCH /v1/repos/:owner/:repo/pulls/:number` - Update PR

### Releases
- `GET /v1/repos/:owner/:repo/releases` - List releases
- `POST /v1/repos/:owner/:repo/releases` - Create release
- `GET /v1/repos/:owner/:repo/releases/latest` - Get latest release

### Wiki
- `GET /v1/repos/:owner/:repo/wiki` - List pages
- `GET /v1/repos/:owner/:repo/wiki/:slug` - Get page
- `POST /v1/repos/:owner/:repo/wiki` - Create page
- `PATCH /v1/repos/:owner/:repo/wiki/:slug` - Update page

### Settings
- `GET /v1/repos/:owner/:repo/settings` - Get settings
- `PATCH /v1/repos/:owner/:repo/settings` - Update settings

## 3. Frontend Architecture

### View Structure (RepositoryView.vue)
- **Header**: Repo name, stats (stars/forks), Action buttons (Star/Fork/Watch).
- **Tabs**:
  - `Code`: File browser, README, Branch selector.
  - `Issues`: List/Filter issues, New Issue.
  - `Pull Requests`: List/Filter PRs, New PR.
  - `Discussions`: (Optional Phase 2)
  - `Actions`: (Optional Phase 2)
  - `Projects`: (Optional Phase 2)
  - `Wiki`: Documentation pages.
  - `Security`: Security policy, advisories.
  - `Insights`: Graphs, contributors.
  - `Settings`: General, Access, Branches, Webhooks.

### Components
- `FileBrowser.vue`: Table with icon, name, commit message, time.
- `ReadmeViewer.vue`: Markdown renderer below file browser.
- `IssueList.vue`: Filterable list.
- `IssueDetail.vue`: Conversation view.
- `WikiPage.vue`: Markdown editor/viewer.
- `ReleaseList.vue`: Timeline of releases.
