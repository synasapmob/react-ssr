import { useState } from "react";
import App from "./app";

export default () => {
  const [count, setCount] = useState(0);

  return (
    <>
      <App />

      <div onClick={() => setCount((prev) => prev + 1)}>
        Other: Counter: {count}
      </div>
    </>
  );
};
