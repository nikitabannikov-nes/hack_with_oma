# Агенты проекта

Сабагенты Claude Code лежат в `.claude/agents/`. Claude подхватывает их автоматически, если открыть Claude Code в корне проекта. Позвать агента явно: «попроси code-reviewer посмотреть мой дифф».

| Агент | Когда звать | Меняет файлы |
|---|---|---|
| `ui-finish-gate-reviewer` | после редизайна, перед демо: PASS/HOLD по интерфейсу | нет |
| `persona-walkthrough` | понять, разберётся ли пользователь на странице | нет |
| `evidence-collector` | проверить фичу в браузере со скриншотами | нет |
| `code-reviewer` | ревью перед PR | нет |
| `minimal-change-engineer` | точечный багфикс минимальным диффом | да |

В начало каждого агента добавлен общий блок «Контекст проекта ОМА». Если меняется структура сайта или способ запуска, обнови этот блок во всех пяти файлах.

## Источник и лицензия

Тексты ролей взяты из [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) и адаптированы под проект: изменены шапки, добавлен контекст, убраны ссылки на чужие скрипты.

MIT License — Copyright (c) 2025 AgentLand Contributors.
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
