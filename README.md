# Bookmark Flow

一个基于 `Vite + React + Manifest V3 + Supabase` 的浏览器书签扩展。

## 核心能力

- 点击扩展图标，打开收藏弹框，可新增、编辑、删除当前页书签
- `Command+J` / `Ctrl+J` 呼出聚焦式悬浮搜索
- 实时模糊匹配书签标题、URL、文件夹
- `↑ ↓ / Enter / Cmd+Enter` 键盘操作
- 已收藏页面在工具栏显示绿色 `✓`
- 管理页支持编辑、拖拽排序、拖到指定文件夹
- 设置页单独管理 Supabase URL、anon key、登录、注册、注销
- 默认预置 Supabase URL 和 anon key，也支持手动改写
- Supabase 账号登录，收藏与编辑直接写入远端

## Supabase 表结构

在 Supabase SQL Editor 中执行：

```sql
create extension if not exists pgcrypto;

create table if not exists public.bookmark_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.bookmark_folders (id) on delete set null,
  title text not null,
  url text not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookmark_folders enable row level security;
alter table public.bookmarks enable row level security;

create policy "folders_select_own"
on public.bookmark_folders
for select
using (auth.uid() = user_id);

create policy "folders_insert_own"
on public.bookmark_folders
for insert
with check (auth.uid() = user_id);

create policy "folders_update_own"
on public.bookmark_folders
for update
using (auth.uid() = user_id);

create policy "folders_delete_own"
on public.bookmark_folders
for delete
using (auth.uid() = user_id);

create policy "bookmarks_select_own"
on public.bookmarks
for select
using (auth.uid() = user_id);

create policy "bookmarks_insert_own"
on public.bookmarks
for insert
with check (auth.uid() = user_id);

create policy "bookmarks_update_own"
on public.bookmarks
for update
using (auth.uid() = user_id);

create policy "bookmarks_delete_own"
on public.bookmarks
for delete
using (auth.uid() = user_id);
```

如果你已经建过表，但扩展里仍然提示：

`Could not find the table 'public.bookmark_folders' in the schema cache`

通常是 Supabase 的 API schema cache 还没刷新。到 Supabase 控制台重新加载一次 API schema，或者稍等片刻再重试。

## 开发与构建

```bash
npm run build
```

构建完成后，打开 Chrome 的扩展管理页，开启开发者模式，加载 `dist/` 目录即可。

加载后可用入口：

- 左键点击工具栏图标：打开收藏弹框
- 右键点击工具栏图标：打开书签管理或设置
- 扩展设置页：`settings.html`
- 扩展管理页：`manage.html`
