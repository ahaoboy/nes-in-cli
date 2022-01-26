import React, { useState, useEffect } from "react";
import { render, Text } from "ink";

const colorList = ["red", "blue", "green"];
const Counter = () => {
  const [counter, setCounter] = useState(0);
  const [color, setColor] = useState("red");

  useEffect(() => {
    const timer = setInterval(() => {
      setCounter((previousCounter) => previousCounter + 1);
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
	setColor(colorList[counter % 3]);
  },[counter])

  return <Text color={color}>{counter} tests passed</Text>;
};

render(<Counter />);
