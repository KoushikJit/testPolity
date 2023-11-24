import { Button } from "@/components/ui/button";
import axios from "axios";
import Image from "next/image";
import { useState } from "react";
import AIComponent from "./ask-ai";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div>
        <AIComponent />
      </div>
    </main>
  );
}
