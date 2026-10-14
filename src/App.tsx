import { Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import AppShell from "@/components/AppShell";
import Command from "@/pages/Command";
import MyDayPage from "@/pages/MyDayPage";
import InboxPage from "@/pages/InboxPage";
import TasksPage from "@/pages/TasksPage";
import CalendarPage from "@/pages/CalendarPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ClientsPage from "@/pages/ClientsPage";
import NotesPage from "@/pages/NotesPage";
import StudyPage from "@/pages/StudyPage";
import IdeasPage from "@/pages/IdeasPage";
import FocusPage from "@/pages/FocusPage";
import CopilotPage from "@/pages/CopilotPage";
import { FocusProvider } from "@/providers/FocusContext";

export default function App() {
  return (
    <FocusProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Command />} />
          <Route path="/my-day" element={<MyDayPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/flow" element={<Navigate to="/tasks" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/assistant" element={<CopilotPage />} />
          <Route path="/copilot" element={<Navigate to="/assistant" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
            fontSize: 13,
            borderRadius: 14,
            boxShadow: "var(--shadow-lift)",
          },
        }}
      />
    </FocusProvider>
  );
}
