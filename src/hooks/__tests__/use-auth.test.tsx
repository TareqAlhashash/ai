import { useState } from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

function TestComponent() {
  const { signIn, signUp, isLoading } = useAuth();
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  return (
    <div>
      <div data-testid="loading">{isLoading ? "loading" : "idle"}</div>
      <div data-testid="result">{result}</div>
      <div data-testid="error">{error}</div>
      <button
        data-testid="sign-in"
        onClick={async () => {
          try {
            const res = await signIn("user@example.com", "password123");
            setResult(JSON.stringify(res));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        Sign in
      </button>
      <button
        data-testid="sign-up"
        onClick={async () => {
          try {
            const res = await signUp("user@example.com", "password123");
            setResult(JSON.stringify(res));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        Sign up
      </button>
    </div>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  test("starts with isLoading false", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("loading").textContent).toBe("idle");
  });

  test("sets isLoading while sign in is pending, then resets it", async () => {
    let resolveSignIn: (value: any) => void;
    (signInAction as any).mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      })
    );

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-in"));

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("loading");
    });

    await act(async () => {
      resolveSignIn!({ success: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("idle");
    });
  });

  test("redirects to a new project built from anonymous work after sign in", async () => {
    const anonMessages = [{ id: "1", role: "user", content: "Hello" }];
    const anonFileSystemData = { "/App.jsx": { type: "file" } };

    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue({
      messages: anonMessages,
      fileSystemData: anonFileSystemData,
    });
    (createProject as any).mockResolvedValue({ id: "anon-project-id" });

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-in"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonMessages,
        data: anonFileSystemData,
      })
    );
    expect(clearAnonWork).toHaveBeenCalled();
    expect(getProjects).not.toHaveBeenCalled();
  });

  test("redirects to the most recent existing project when there is no anonymous work", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([
      { id: "recent-project" },
      { id: "older-project" },
    ]);

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-in"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/recent-project");
    });

    expect(createProject).not.toHaveBeenCalled();
  });

  test("creates a brand new project when there is no anonymous work and no existing projects", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-project-id" });

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-in"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/new-project-id");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [],
        data: {},
        name: expect.stringMatching(/^New Design #\d+$/),
      })
    );
  });

  test("does not redirect or create a project when sign in fails", async () => {
    (signInAction as any).mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-in"));

    await waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe(
        JSON.stringify({ success: false, error: "Invalid credentials" })
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
    expect(getAnonWorkData).not.toHaveBeenCalled();
  });

  test("resets isLoading and propagates the error when sign in rejects", async () => {
    (signInAction as any).mockRejectedValue(new Error("Network error"));

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-in"));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("Network error");
    });

    expect(screen.getByTestId("loading").textContent).toBe("idle");
  });

  test("runs the same post-sign-up redirect flow as sign in", async () => {
    (signUpAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([{ id: "existing-project" }]);

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-up"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });

    expect(signUpAction).toHaveBeenCalledWith(
      "user@example.com",
      "password123"
    );
  });

  test("does not redirect when sign up fails", async () => {
    (signUpAction as any).mockResolvedValue({
      success: false,
      error: "Email already registered",
    });

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sign-up"));

    await waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe(
        JSON.stringify({ success: false, error: "Email already registered" })
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
