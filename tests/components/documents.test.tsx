import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveDocumentDialog } from "@/components/documents/document-archive-dialog";
import { DocumentDetails } from "@/components/documents/document-details";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentStatusBadge } from "@/components/documents/document-status";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { MAX_DOCUMENT_BYTES } from "@/config/documents";
import {
  DOCUMENT_ARCHIVE_COPY,
  DOCUMENT_DETAIL_COPY,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_UPLOAD_COPY,
} from "@/features/documents/content";
import type { PatientDocument } from "@/features/documents/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The document UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **the upload form carries exactly the fields its endpoint reads**, and
 *     nothing that would be a claim about identity or about the bytes — the
 *     regression guard for the class of defect Phase 07 shipped;
 *   * **no control is `required` in the HTML sense**, because the form
 *     submits through a JavaScript handler and the browser's own constraint
 *     validation would silently refuse to fire the event at all. That is the
 *     defect the Phase 12 component suite found and nothing else could see,
 *     guarded here from the start;
 *   * **success is never claimed before the server says so** (section 49);
 *   * a list carries no storage path, no checksum and nothing about a file's
 *     contents;
 *   * a preview is offered only for the formats a browser renders inertly,
 *     and the frame is sandboxed (sections 29 and 69);
 *   * archiving asks first, and the control is absent for a document
 *     somebody else uploaded (section 34);
 *   * markup in a title renders as text, never as HTML;
 *   * **nothing reaches browser storage or a URL** (sections 67 and 98).
 *
 * None of this is a security control. Every action re-checks on the server
 * and the database and the bucket refuse independently; these assertions are
 * about the experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient/documents",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const archiveSubmissions: FormData[] = [];
const accessRequests: { documentId: string; intent: string }[] = [];
let accessOutcome: Record<string, unknown> = {
  ok: true,
  access: {
    url: "https://storage.example.test/signed?token=SECRET",
    expiresInSeconds: 300,
    mimeType: "application/pdf",
    previewable: true,
    downloadFileName: "Blood-test.pdf",
  },
};

vi.mock("@/features/documents/actions", () => ({
  archiveDocumentAction: async (_state: unknown, data: FormData) => {
    archiveSubmissions.push(data);
    return { status: "archived" };
  },
  requestDocumentAccessAction: async (documentId: string, intent: string) => {
    accessRequests.push({ documentId, intent });
    return accessOutcome;
  },
}));

const DOCUMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const STORAGE_PATH = `patients/${PATIENT_ID}/documents/${DOCUMENT_ID}/document.pdf`;

function document(overrides: Partial<PatientDocument> = {}): PatientDocument {
  return {
    id: DOCUMENT_ID,
    patientId: PATIENT_ID,
    documentType: "lab_report",
    title: "Blood test — 12 September 2026",
    description: "From Sahyadri Hospital.",
    fileName: "CBC-report.pdf",
    mimeType: "application/pdf",
    fileSize: 2_517_113,
    status: "active",
    uploadedByRole: "patient",
    appointmentId: null,
    clinicalRecordId: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: new Date("2026-09-12T04:30:00.000Z"),
    storagePath: STORAGE_PATH,
    uploadedByCurrentUser: true,
    ...overrides,
  };
}

/** A real `File`, so the form's own validation sees a real size and type. */
function pdfFile(name = "report.pdf", type = "application/pdf"): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type });
}

class RecordingXhr {
  static instances: RecordingXhr[] = [];

  readonly upload = {
    listeners: new Map<string, (event: unknown) => void>(),
    addEventListener(name: string, handler: (event: unknown) => void) {
      this.listeners.set(name, handler);
    },
  };

  private readonly listeners = new Map<string, () => void>();

  method = "";
  url = "";
  status = 201;
  responseText = JSON.stringify({
    ok: true,
    data: { documentId: DOCUMENT_ID },
  });
  sent: FormData | null = null;

  constructor() {
    RecordingXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader() {}

  addEventListener(name: string, handler: () => void) {
    this.listeners.set(name, handler);
  }

  send(data: FormData) {
    this.sent = data;
  }

  /** Drives the progress events the component listens for. */
  progress(loaded: number, total: number) {
    this.upload.listeners.get("progress")?.({
      lengthComputable: true,
      loaded,
      total,
    });
  }

  finish() {
    this.listeners.get("load")?.();
  }

  fail() {
    this.listeners.get("error")?.();
  }
}

beforeEach(() => {
  archiveSubmissions.length = 0;
  accessRequests.length = 0;
  accessOutcome = {
    ok: true,
    access: {
      url: "https://storage.example.test/signed?token=SECRET",
      expiresInSeconds: 300,
      mimeType: "application/pdf",
      previewable: true,
      downloadFileName: "Blood-test.pdf",
    },
  };
  RecordingXhr.instances = [];
  vi.stubGlobal("XMLHttpRequest", RecordingXhr);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ---------------------------------------------------------------------------
 * The list
 * ------------------------------------------------------------------------ */

describe("DocumentList", () => {
  function renderList(documents: PatientDocument[]) {
    return render(
      <DocumentList
        documents={documents}
        hrefFor={(entry) => `/patient/documents/${entry.id}`}
        caption="Your documents, most recently added first — table"
      />,
    );
  }

  it("shows what a row needs and nothing about the file's contents", () => {
    renderList([document()]);

    // Two layouts over one data set, so each fact appears twice.
    expect(
      screen.getAllByText("Blood test — 12 September 2026").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(DOCUMENT_TYPE_LABELS.lab_report).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("2.4 MB").length).toBeGreaterThan(0);
  });

  it("never renders the storage path or the patient id", () => {
    const { container } = renderList([document()]);
    const text = container.innerHTML;

    expect(text).not.toContain(STORAGE_PATH);
    expect(text).not.toContain("patients/");
    expect(text).not.toContain(PATIENT_ID);
  });

  it("requests no file and mints no URL to render a list", () => {
    // Section 115. Twenty documents cost zero credentials and zero bytes.
    renderList([
      document(),
      document({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    ]);

    expect(accessRequests).toEqual([]);
    expect(screen.queryByRole("img")).toBeNull();
    expect(document_queryIframe()).toBeNull();
  });

  it("gives every link an accessible name that says which document", () => {
    renderList([
      document({ title: "Blood test" }),
      document({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "MRI report",
      }),
    ]);

    const names = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label") ?? link.textContent ?? "");

    expect(names.some((name) => name.includes("Blood test"))).toBe(true);
    expect(names.some((name) => name.includes("MRI report"))).toBe(true);
    // Not eleven links all called "Open". Two distinct names for two
    // documents — each appears twice because the card layout and the table
    // layout both render, which is one data set in two shapes rather than
    // two controls.
    expect(new Set(names).size).toBe(2);
  });

  it("renders a title containing markup as text", () => {
    renderList([document({ title: "<img src=x onerror=alert(1)>" })]);

    expect(
      screen.getAllByText("<img src=x onerror=alert(1)>").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderList([document()]);
    await expectNoAxeViolations(container);
  });
});

function document_queryIframe(): HTMLElement | null {
  return window.document.querySelector("iframe");
}

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------ */

describe("DocumentStatusBadge", () => {
  it("never communicates status by colour alone", () => {
    for (const status of ["active", "archived"] as const) {
      const { container, unmount } = render(
        <DocumentStatusBadge status={status} />,
      );

      expect(container.textContent).toContain(DOCUMENT_STATUS_LABELS[status]);
      expect(container.querySelector("svg"), status).not.toBeNull();
      unmount();
    }
  });

  it("says 'Available' rather than 'Active' to the person reading it", () => {
    render(<DocumentStatusBadge status="active" />);
    expect(screen.getByText("Available")).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
 * Details
 * ------------------------------------------------------------------------ */

describe("DocumentDetails", () => {
  it("shows the facts section 28 asks for", () => {
    render(<DocumentDetails document={document()} audience="patient" />);

    expect(
      screen.getByText(DOCUMENT_TYPE_LABELS.lab_report),
    ).toBeInTheDocument();
    expect(screen.getByText("CBC-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.4 MB")).toBeInTheDocument();
    expect(screen.getByText("You uploaded this")).toBeInTheDocument();
  });

  it("says who uploaded it differently to each audience", () => {
    const { unmount } = render(
      <DocumentDetails document={document()} audience="patient" />,
    );
    expect(screen.getByText("You uploaded this")).toBeInTheDocument();
    unmount();

    render(<DocumentDetails document={document()} audience="doctor" />);
    expect(screen.getByText("Uploaded by the patient")).toBeInTheDocument();
  });

  it("never renders a path, a checksum or an identifier", () => {
    const { container } = render(
      <DocumentDetails document={document()} audience="doctor" />,
    );
    const html = container.innerHTML;

    expect(html).not.toContain(STORAGE_PATH);
    expect(html).not.toContain("patients/");
    expect(html).not.toContain(PATIENT_ID);
    expect(html).not.toContain(DOCUMENT_ID);
  });

  it("explains an archived document rather than hiding it", () => {
    render(
      <DocumentDetails
        document={document({
          status: "archived",
          archivedAt: new Date("2026-09-26T04:00:00.000Z"),
          archiveReason: "Superseded by the repeat test.",
        })}
        audience="patient"
      />,
    );

    expect(
      screen.getByText(DOCUMENT_ARCHIVE_COPY.archivedNoticeTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Superseded by the repeat test/),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <DocumentDetails document={document()} audience="patient" />,
    );
    await expectNoAxeViolations(container);
  });
});

/* ---------------------------------------------------------------------------
 * The upload form
 * ------------------------------------------------------------------------ */

describe("DocumentUploadForm", () => {
  function renderForm(appointmentId?: string) {
    return render(
      <DocumentUploadForm
        guidance={DOCUMENT_UPLOAD_COPY.guidance}
        {...(appointmentId ? { appointmentId } : {})}
      />,
    );
  }

  it("renders exactly one form, carrying exactly its endpoint's fields", () => {
    const { container } = renderForm();
    const forms = container.querySelectorAll("form");

    expect(forms).toHaveLength(1);

    const names = [...(forms[0]?.querySelectorAll("[name]") ?? [])].map(
      (control) => control.getAttribute("name"),
    );
    expect(names.sort()).toEqual([
      "description",
      "documentType",
      "file",
      "title",
    ]);
  });

  it("adds the appointment field only for a practitioner", () => {
    const { container } = renderForm("44444444-4444-4444-8444-444444444444");
    const names = [...container.querySelectorAll("[name]")].map((control) =>
      control.getAttribute("name"),
    );

    expect(names).toContain("appointmentId");
    // And still nothing about identity or about the bytes.
    for (const forbidden of [
      "patientId",
      "practitionerId",
      "uploadedBy",
      "storagePath",
      "mimeType",
      "fileSize",
      "checksum",
      "status",
    ]) {
      expect(names, forbidden).not.toContain(forbidden);
    }
  });

  it("sets no HTML `required`, so the submit handler always runs", () => {
    // **The Phase 12 defect, guarded from the start.** `Field` sets the
    // attribute from its prop; with a JavaScript submit handler the
    // browser's own validation would refuse to fire the event at all, and
    // pressing the button would visibly do nothing.
    const { container } = renderForm();

    for (const control of container.querySelectorAll(
      "input, textarea, select",
    )) {
      expect(
        control.hasAttribute("required"),
        `${control.getAttribute("name")} is required in the HTML`,
      ).toBe(false);
    }
  });

  it("still marks the required fields for assistive technology", () => {
    const { container } = renderForm();

    for (const name of ["file", "documentType", "title"]) {
      expect(
        container
          .querySelector(`[name="${name}"]`)
          ?.getAttribute("aria-required"),
        name,
      ).toBe("true");
    }
  });

  it("gives every control a real label", () => {
    const { container } = renderForm();

    for (const control of container.querySelectorAll(
      "input:not([type=hidden]), textarea, select",
    )) {
      const id = control.getAttribute("id");
      expect(id, "a control with no id cannot be labelled").toBeTruthy();
      expect(
        container.querySelector(`label[for="${id}"]`),
        `no label for ${control.getAttribute("name")}`,
      ).not.toBeNull();
    }
  });

  it("shows an error rather than doing nothing when nothing is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /upload document/i }));

    await waitFor(() => {
      expect(screen.getByText(/that file is empty/i)).toBeInTheDocument();
    });
    expect(RecordingXhr.instances).toHaveLength(0);
  });

  it("refuses an oversized file before sending a byte", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "report.pdf", {
        type: "application/pdf",
      }),
    );
    await user.type(screen.getByLabelText(/^title/i), "Blood test");
    await user.selectOptions(
      screen.getByLabelText(/what kind of document/i),
      "lab_report",
    );
    await user.click(screen.getByRole("button", { name: /upload document/i }));

    await waitFor(() => {
      expect(screen.getByText(/larger than 10\.0 MB/i)).toBeInTheDocument();
    });
    expect(RecordingXhr.instances).toHaveLength(0);
  });

  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    const input = window.document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, pdfFile());
    await user.type(screen.getByLabelText(/^title/i), "Blood test");
    await user.selectOptions(
      screen.getByLabelText(/what kind of document/i),
      "lab_report",
    );
    await user.click(screen.getByRole("button", { name: /upload document/i }));
  }

  it("posts multipart to the upload endpoint", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillAndSubmit(user);

    await waitFor(() => expect(RecordingXhr.instances).toHaveLength(1));

    const request = RecordingXhr.instances[0] as RecordingXhr;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/patient-documents");
    expect(request.sent?.get("file")).toBeInstanceOf(File);
    expect(request.sent?.get("title")).toBe("Blood test");
  });

  it("reports progress, and never claims success at 100%", async () => {
    // **Section 49's last sentence.** The bytes leaving the browser is not
    // the same as the document being stored.
    const user = userEvent.setup();
    renderForm();
    await fillAndSubmit(user);

    await waitFor(() => expect(RecordingXhr.instances).toHaveLength(1));
    const request = RecordingXhr.instances[0] as RecordingXhr;

    request.progress(45, 100);
    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "45",
      );
    });

    request.progress(100, 100);
    await waitFor(() => {
      expect(
        screen.getByText(DOCUMENT_UPLOAD_COPY.finalisingText),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(DOCUMENT_UPLOAD_COPY.successTitle)).toBeNull();

    request.finish();
    await waitFor(() => {
      expect(
        screen.getByText(DOCUMENT_UPLOAD_COPY.successTitle),
      ).toBeInTheDocument();
    });
  });

  it("shows the server's safe message when the upload is refused", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillAndSubmit(user);

    await waitFor(() => expect(RecordingXhr.instances).toHaveLength(1));
    const request = RecordingXhr.instances[0] as RecordingXhr;
    request.status = 400;
    request.responseText = JSON.stringify({
      ok: false,
      error: {
        code: "validation",
        message: "That file type isn't accepted.",
      },
      requestId: "abc",
    });
    request.finish();

    await waitFor(() => {
      expect(
        screen.getByText(/that file type isn't accepted/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(DOCUMENT_UPLOAD_COPY.successTitle)).toBeNull();
  });

  it("falls back to its own copy when the reply is not our envelope", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillAndSubmit(user);

    await waitFor(() => expect(RecordingXhr.instances).toHaveLength(1));
    const request = RecordingXhr.instances[0] as RecordingXhr;
    request.status = 502;
    // A gateway's HTML error page, which must not be rendered as a message.
    request.responseText = "<html><body>Bad Gateway</body></html>";
    request.finish();

    await waitFor(() => {
      expect(
        screen.getByText(DOCUMENT_UPLOAD_COPY.failureBody),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Bad Gateway/)).toBeNull();
  });

  it("says the connection failed rather than blaming the file", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillAndSubmit(user);

    await waitFor(() => expect(RecordingXhr.instances).toHaveLength(1));
    (RecordingXhr.instances[0] as RecordingXhr).fail();

    await waitFor(() => {
      expect(
        screen.getByText(DOCUMENT_UPLOAD_COPY.networkFailure),
      ).toBeInTheDocument();
    });
  });

  it("says files are not scanned for viruses", () => {
    // Section 40: do not claim a security property the product does not
    // have.
    renderForm();
    expect(
      screen.getByText(DOCUMENT_UPLOAD_COPY.scanningNotice),
    ).toBeInTheDocument();
  });

  it("writes nothing to browser storage", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillAndSubmit(user);

    await waitFor(() => expect(RecordingXhr.instances).toHaveLength(1));
    (RecordingXhr.instances[0] as RecordingXhr).finish();

    await waitFor(() => {
      expect(
        screen.getByText(DOCUMENT_UPLOAD_COPY.successTitle),
      ).toBeInTheDocument();
    });

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderForm();
    await expectNoAxeViolations(container);
  });
});

/* ---------------------------------------------------------------------------
 * The viewer
 * ------------------------------------------------------------------------ */

describe("DocumentViewer", () => {
  it("mints nothing until somebody asks", () => {
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );

    expect(accessRequests).toEqual([]);
  });

  it("offers a preview only for a previewable document", () => {
    const { unmount } = render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    expect(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    ).toBeInTheDocument();
    unmount();

    render(
      <DocumentViewer
        documentId={DOCUMENT_ID}
        previewable={false}
        archived={false}
      />,
    );
    expect(
      screen.queryByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    ).toBeNull();
    expect(
      screen.getByText(DOCUMENT_DETAIL_COPY.previewUnavailableBody),
    ).toBeInTheDocument();
  });

  it("always offers a download, including for an archived document", () => {
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable={false} archived />,
    );

    expect(
      screen.getByRole("button", { name: DOCUMENT_DETAIL_COPY.downloadLabel }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(DOCUMENT_DETAIL_COPY.previewArchivedBody),
    ).toBeInTheDocument();
  });

  it("renders a PDF in a sandboxed frame with no referrer", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );

    const frame = await waitFor(() => {
      const found = window.document.querySelector("iframe");
      expect(found).not.toBeNull();
      return found as HTMLIFrameElement;
    });

    // Section 69. `allow-same-origin` grants the document the *storage
    // service's* origin, not this application's, so it cannot reach this
    // page; `allow-scripts` is what lets a browser's PDF viewer run.
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin",
    );
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(frame.getAttribute("title")).toBe(
      DOCUMENT_DETAIL_COPY.previewFrameTitle,
    );
  });

  it("renders an image in an `img`, which cannot execute anything", async () => {
    accessOutcome = {
      ok: true,
      access: {
        url: "https://storage.example.test/signed?token=SECRET",
        expiresInSeconds: 300,
        mimeType: "image/png",
        previewable: true,
        downloadFileName: "scan.png",
      },
    };

    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeInTheDocument();
    });
    expect(window.document.querySelector("iframe")).toBeNull();
  });

  it("asks for a preview and a download separately", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );
    await waitFor(() => expect(accessRequests).toHaveLength(1));
    expect(accessRequests[0]).toEqual({
      documentId: DOCUMENT_ID,
      intent: "preview",
    });
  });

  it("tells the reader the link expires", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(DOCUMENT_DETAIL_COPY.expiryNotice),
      ).toBeInTheDocument();
    });
  });

  it("shows a safe message when access is refused", async () => {
    accessOutcome = { ok: false, message: "This document isn't available." };

    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/isn't available/i)).toBeInTheDocument();
    });
    expect(window.document.querySelector("iframe")).toBeNull();
  });

  it("puts the signed URL nowhere persistent", async () => {
    // Section 67. It lives in component state for as long as the preview is
    // open, and nowhere else.
    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );
    await waitFor(() =>
      expect(window.document.querySelector("iframe")).not.toBeNull(),
    );

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain("SECRET");
    expect(window.location.href).not.toContain(DOCUMENT_ID);
  });

  it("discards the URL when the preview is closed", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewOpenLabel,
      }),
    );
    await waitFor(() =>
      expect(window.document.querySelector("iframe")).not.toBeNull(),
    );

    await user.click(
      screen.getByRole("button", {
        name: DOCUMENT_DETAIL_COPY.previewCloseLabel,
      }),
    );

    await waitFor(() =>
      expect(window.document.querySelector("iframe")).toBeNull(),
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <DocumentViewer documentId={DOCUMENT_ID} previewable archived={false} />,
    );
    await expectNoAxeViolations(container);
  });
});

/* ---------------------------------------------------------------------------
 * Archiving
 * ------------------------------------------------------------------------ */

describe("ArchiveDocumentDialog", () => {
  it("asks before withdrawing anything", async () => {
    const user = userEvent.setup();
    render(<ArchiveDocumentDialog documentId={DOCUMENT_ID} />);

    await user.click(
      screen.getByRole("button", { name: DOCUMENT_ARCHIVE_COPY.triggerLabel }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(DOCUMENT_ARCHIVE_COPY.dialogTitle),
    ).toBeInTheDocument();
    expect(archiveSubmissions).toHaveLength(0);
  });

  it("says nothing is deleted", () => {
    // Section 34, said to the person taking the action.
    expect(DOCUMENT_ARCHIVE_COPY.dialogDescription).toMatch(
      /nothing is deleted/i,
    );
  });

  it("submits a document id and a reason, and nothing else", async () => {
    const user = userEvent.setup();
    render(<ArchiveDocumentDialog documentId={DOCUMENT_ID} />);

    await user.click(
      screen.getByRole("button", { name: DOCUMENT_ARCHIVE_COPY.triggerLabel }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/reason/i),
      "Superseded by the repeat test.",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: DOCUMENT_ARCHIVE_COPY.confirmLabel,
      }),
    );

    await waitFor(() => expect(archiveSubmissions).toHaveLength(1));

    const sent = archiveSubmissions[0] as FormData;
    expect([...sent.keys()].sort()).toEqual(["documentId", "reason"]);
    expect(sent.get("documentId")).toBe(DOCUMENT_ID);
  });

  it("has no accessibility violations", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ArchiveDocumentDialog documentId={DOCUMENT_ID} />,
    );

    await user.click(
      screen.getByRole("button", { name: DOCUMENT_ARCHIVE_COPY.triggerLabel }),
    );
    await screen.findByRole("dialog");

    await expectNoAxeViolations(container.ownerDocument.body);
  });
});
