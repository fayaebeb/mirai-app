import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { TaskReminderService } from "@/components/task-reminder-service";
import { RecoilRoot } from "recoil";
import Settings from "./components/Settings";
import VoiceModePage from "./pages/voice-mode-page";
import AppLayout from "./pages/app-layout";

// Wrapper component that only renders the reminder service when authenticated
function TaskReminders() {
  const { user } = useAuth();

  if (!user) return null;

  return <TaskReminderService />;
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={AppLayout} />
      <ProtectedRoute path="/voice" component={VoiceModePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/test" component={AppLayout} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <TaskReminders />
          <Toaster />
          <Settings />
        </AuthProvider>
      </QueryClientProvider>
    </RecoilRoot>
  );
}

export default App;