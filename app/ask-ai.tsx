"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import React, { useState } from "react";

type Props = {};

const AIComponent = (props: Props) => {
  // state
  const [question, setQuestion] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input placeholder="start typing..." onChange={onchange}></Input>
      <Button onClick={onRead}>Read</Button>
    </div>
  );

  // handler function
  async function onRead() {
    console.log(question);
    const response = await axios.post("api/read", { question: question });
    console.log(response.data);
  }
  function onchange(e: any){
    setQuestion(e.target.value);
  }
};

export default AIComponent;
