"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HavocWebSocket } from "../lib/websocket";
import type { ExecutablePolicy, InspectionResult, WSEvent } from "../lib/types";

import { API_URL, WS_URL } from "../lib/config";

export interface AssemblyStep {
  PHASE: number;
  PART_ID: string;
  ACTION: string;
  TARGET_LOCATION: string;
  TOOL: string;
}

interface BinData {
  id: string;
  count: number;
  color: string;
}

interface SystemStatus {
  run_id?: string;
  part_counter?: number;
  events_stored?: number;
  camera?: boolean;
  camera_backend?: string;
  orchestrator_model?: string;
  ws_clients?: number;
  status?: string;
}

interface HavocState {
  status: string;
  policy: ExecutablePolicy | null;
  assemblySequence: AssemblyStep[] | null;
  assemblyError: string | null;
  events: InspectionResult[];
  lastResult: InspectionResult | null;
  bins: BinData[];
  stats: { total: number; passRate: number; avgConf: number };
  lastAnimation: { target?: string; part_color?: string } | null;
  uploadError: string | null;
  processingStep: string;
  systemStatus: SystemStatus | null;
}

interface HavocContextValue extends HavocState {
  setStatus: (s: string) => void;
  handleUpload: (file: File) => Promise<void>;
  handleApprove: (policyId: string) => void;
  handleReject: (policyId: string) => void;
  handleInspect: () => Promise<void>;
  handleQA: (question: string) => Promise<string>;
  handleStop: () => void;
  setUploadError: (e: string | null) => void;
  setProcessingStep: (s: string) => void;
  setSelectedEvent: (e: InspectionResult | null) => void;
  selectedEvent: InspectionResult | null;
  isInspecting: boolean;
  refreshEvents: () => Promise<void>;
  handleVerify: () => Promise<void>;
  verification: { available: boolean; missing: string[]; message: string } | null;
}

const defaultBins: BinData[] = [
  { id: "BIN_A", count: 0, color: "#FF3333" },
  { id: "BIN_B", count: 0, color: "#3388FF" },
  { id: "BIN_C", count: 0, color: "#00FF66" },
  { id: "REJECT_BIN", count: 0, color: "#FF3333" },
];

const HavocContext = createContext<HavocContextValue | null>(null);

export function HavocProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState("READY");
  const [policy, setPolicy] = useState<ExecutablePolicy | null>(null);
  const [assemblySequence, setAssemblySequence] = useState<AssemblyStep[] | null>(null);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  const [events, setEvents] = useState<InspectionResult[]>([]);
  const [lastResult, setLastResult] = useState<InspectionResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<InspectionResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [lastAnimation, setLastAnimation] = useState<{ target?: string; part_color?: string } | null>(null);
  const [bins, setBins] = useState<BinData[]>(defaultBins);
  const [stats, setStats] = useState({ total: 0, passRate: 0, avgConf: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState("");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [verification, setVerification] = useState<{ available: boolean; missing: string[]; message: string } | null>(null);
  const wsRef = useRef<HavocWebSocket | null>(null);

  // Central status poll — single source for run_id, part_counter, events_stored, etc.
  useEffect(() => {
    const poll = () => {
      fetch(`${API_URL}/status`)
        .then((r) => r.json())
        .then((d) =>
          setSystemStatus({
            run_id: d.run_id,
            part_counter: d.part_counter,
            events_stored: d.events_stored,
            camera: d.camera,
            camera_backend: d.camera_backend,
            orchestrator_model: d.orchestrator_model,
            ws_clients: d.ws_clients,
            status: d.status,
          })
        )
        .catch(() => setSystemStatus(null));
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // Hydrate events from DB on mount
  useEffect(() => {
    fetch(`${API_URL}/events/inspections?limit=200`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: InspectionResult[]) => {
        if (list.length === 0) return;
        setEvents(list);
        setLastResult(list[0]);
        const binsNext = [...defaultBins];
        let total = 0;
        let passed = 0;
        let confSum = 0;
        for (const ev of list) {
          const bin = binsNext.find((b) => b.id === ev.decision.target_bin);
          if (bin) bin.count += 1;
          total += 1;
          if (ev.decision.action !== "REJECT") passed += 1;
          confSum += ev.classification.confidence;
        }
        setBins(binsNext);
        setStats({
          total,
          passRate: total > 0 ? passed / total : 0,
          avgConf: total > 0 ? confSum / total : 0,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ws = new HavocWebSocket(WS_URL);
    wsRef.current = ws;
    ws.connect();

    const unsub = ws.onEvent((event: WSEvent) => {
      if (event.type === "inspection") {
        const result = event.data as unknown as InspectionResult;
        setLastResult(result);
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.part_id));
          if (seen.has(result.part_id)) return prev;
          return [result, ...prev].slice(0, 200);
        });
        setStatus("RUNNING");
        setBins((prev) =>
          prev.map((b) => (b.id === result.decision.target_bin ? { ...b, count: b.count + 1 } : b))
        );
        setStats((prev) => {
          const total = prev.total + 1;
          const rejected = result.decision.action === "REJECT" ? 1 : 0;
          const passed = total - rejected;
          return {
            total,
            passRate: passed / total,
            avgConf: (prev.avgConf * prev.total + result.classification.confidence) / total,
          };
        });
        setLastAnimation({
          target: result.decision.target_bin,
          part_color: result.classification.color_hex,
        });
      }
      if (event.type === "policy_update") {
        const data = event.data as { policy?: ExecutablePolicy; action?: string; run_id?: string };
        if (data.policy) setPolicy(data.policy);
        if (data.action === "approved") {
          setBins(defaultBins);
          setEvents([]);
          setLastResult(null);
          setStats({ total: 0, passRate: 0, avgConf: 0 });
          setVerification(null);
        }
      }
      if (event.type === "status") {
        const data = event.data as { status?: string };
        if (data?.status === "STOPPED") setStatus("STOPPED");
      }
      if (event.type === "factory_floor") {
        const data = event.data as { target?: string; part_color?: string };
        setLastAnimation(data);
      }
    });

    fetch(`${API_URL}/policies/active`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) setPolicy(p);
      })
      .catch(() => {});

    return () => {
      unsub();
      ws.disconnect();
    };
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setAssemblyError(null);
    setProcessingStep("Starting...");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_URL}/documents/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.text();
        setUploadError(err || `Upload failed (${res.status})`);
        return;
      }
      const doc = await res.json();
      if (doc.policy) setPolicy(doc.policy);
      setAssemblySequence(doc.assembly_sequence?.length ? doc.assembly_sequence : null);
      setAssemblyError(doc.assembly_error || null);
    } catch (e) {
      setUploadError(String(e));
    }
    setProcessingStep("");
  }, []);

  const handleApprove = useCallback(async (policyId: string) => {
    try {
      await fetch(`${API_URL}/policies/${policyId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: "operator-1" }),
      });
      setPolicy((prev) => (prev ? { ...prev, status: "APPROVED" } : prev));
      setStatus("RUNNING");
    } catch (e) {
      console.error("Approve failed:", e);
    }
  }, []);

  const handleReject = useCallback(async (policyId: string) => {
    try {
      await fetch(`${API_URL}/policies/${policyId}/reject`, { method: "POST" });
      setPolicy((prev) => (prev ? { ...prev, status: "REJECTED" } : prev));
    } catch (e) {
      console.error("Reject failed:", e);
    }
  }, []);

  const handleVerify = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_camera: true }),
      });
      const data = await res.json();
      setVerification({ available: data.available, missing: data.missing || [], message: data.message || "" });
    } catch (e) {
      setVerification({ available: false, missing: [], message: String(e) });
    }
  }, []);

  const handleInspect = useCallback(async () => {
    setIsInspecting(true);
    try {
      const res = await fetch(`${API_URL}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_camera: true }),
      });
      if (!res.ok) console.error("Inspect failed:", await res.text());
    } catch (e) {
      console.error("Inspect failed:", e);
    }
    setIsInspecting(false);
  }, []);

  const handleQA = useCallback(async (question: string): Promise<string> => {
    const res = await fetch(`${API_URL}/qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    return data.answer || "No answer";
  }, []);

  const handleStop = useCallback(async () => {
    try {
      await fetch(`${API_URL}/stop`, { method: "POST" });
      setStatus("STOPPED");
    } catch (e) {
      console.error("Stop failed:", e);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const list = await fetch(`${API_URL}/events/inspections?limit=200`).then((r) =>
        r.ok ? r.json() : []
      );
      if (list.length === 0) return;
      setEvents(list);
      setLastResult(list[0]);
      const binsNext = [...defaultBins];
      let total = 0;
      let passed = 0;
      let confSum = 0;
      for (const ev of list) {
        const bin = binsNext.find((b) => b.id === ev.decision.target_bin);
        if (bin) bin.count += 1;
        total += 1;
        if (ev.decision.action !== "REJECT") passed += 1;
        confSum += ev.classification.confidence;
      }
      setBins(binsNext);
      setStats({
        total,
        passRate: total > 0 ? passed / total : 0,
        avgConf: total > 0 ? confSum / total : 0,
      });
    } catch (e) {
      console.error("Refresh events failed:", e);
    }
  }, []);

  const value: HavocContextValue = {
    status,
    policy,
    assemblySequence,
    assemblyError,
    events,
    lastResult,
    bins,
    stats,
    lastAnimation,
    uploadError,
    processingStep,
    systemStatus,
    setStatus,
    handleUpload,
    handleApprove,
    handleReject,
    handleInspect,
    handleQA,
    handleStop,
    setUploadError,
    setProcessingStep,
    setSelectedEvent,
    selectedEvent,
    isInspecting,
    refreshEvents,
    handleVerify,
    verification,
  };

  return <HavocContext.Provider value={value}>{children}</HavocContext.Provider>;
}

export function useHavoc() {
  const ctx = useContext(HavocContext);
  if (!ctx) throw new Error("useHavoc must be used within HavocProvider");
  return ctx;
}
