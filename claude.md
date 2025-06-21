## ✨ Rules for Building Better Software with DRF (Django REST Framework) and Vanilla JS



---

## 🧱 STRUCTURE & DESIGN

### 1. Start with a Clear Domain Model
- Design data models first with Django ORM.
- Keep models lean — only include domain logic.

### 2. Thin Views, Fat Serializers
- Keep business logic out of views.
- Serializers handle validation, transformation, and conditional fields.

### 3. Use ViewSets + Routers
- Prefer `ModelViewSet` when CRUD fits.
- Use `@action` for custom behavior.
- Organize large logic into services/helpers.

### 4. Service Layer Pattern
- Extract reusable logic to service classes or functions.
- Improves testability and separation of concerns.

---

## ⚙️ PERFORMANCE & OPTIMIZATION

### 5. Use `select_related` and `prefetch_related`
- Avoid N+1 query issues.
- overall write optimized code for orms.

### 6. Use best practices in vanilla JS
- write performant code when writing js logic.
- ensure the code files doesn't exceed 500 lines of code
