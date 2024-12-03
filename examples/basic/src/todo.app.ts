import { streamable } from "streambly"

type Todo = {
  id: number
  content: string
  isCompleted: boolean
}

type TodoApp = {
  todos: Todo[]
}

type TodoAPI = {
  addTodo: (content: string) => void
  toggleTodo: (id: number) => void
  removeTodo: (id: number) => void
}

export const todoApp = streamable<TodoApp>()
  .api<TodoAPI>()
  .impls(({ setCurrent }, initialValue = { todos: [] as Todo[] }) => {
    return {
      initialValue,
      controller: {
        addTodo: (content) => {
          initialValue.todos.push({
            id: Date.now(),
            content,
            isCompleted: false
          })

          setCurrent(initialValue)
        },
        toggleTodo: (id) => {
          const todo = initialValue.todos.find(todo => todo.id === id)
          if (todo) {
            todo.isCompleted = !todo.isCompleted
            setCurrent(initialValue)
          }
        },
        removeTodo: (id) => {
          initialValue.todos = initialValue.todos.filter(todo => todo.id !== id)
          setCurrent(initialValue)
        }
      }
    }
  })