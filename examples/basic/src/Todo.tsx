import React from "react";
import { useState } from "react";
import { todoApp } from "./todo.app";
import { createStream } from "streambly-react";

const todoStream = createStream(todoApp);

export function App() {
	return (
		<todoStream.Provider>
			<TodoList />
			<TodoForm />
		</todoStream.Provider>
	);
}

function TodoList() {
	const todos = todoStream.useValueStream((stream) => stream.todos);
	const { removeTodo, toggleTodo } = todoStream.useAPI();

	return (
		<ul>
			{todos.map((todo) => (
				<li key={todo.id}>
					<input
						type="checkbox"
						checked={todo.isCompleted}
						onChange={() => toggleTodo(todo.id)}
					/>
					<span>{todo.content}</span>
					<button type="button" onClick={() => removeTodo(todo.id)}>
						Remove
					</button>
				</li>
			))}
		</ul>
	);
}

function TodoForm() {
	const [content, setContent] = useState("");
	const { addTodo } = todoStream.useAPI();

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				addTodo(content);
				setContent("");
			}}
		>
			<input
				type="text"
				value={content}
				onChange={(event) => setContent(event.target.value)}
			/>
			<button type="submit">Add</button>
		</form>
	);
}

export default App;
