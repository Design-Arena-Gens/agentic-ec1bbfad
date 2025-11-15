"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type LeadForm = {
  company_name: string;
  contact_name: string;
  job_title: string;
  email_guess: string;
  linkedin_url: string;
  company_size: string;
  pain_points: string;
  lead_score: string;
  score_reason: string;
  personalized_message: string;
};

type LeadInsight = {
  leadScore: number;
  scoreReason: string;
  personalizedMessage: string;
  missingFields: string[];
};

const initialForm: LeadForm = {
  company_name: "",
  contact_name: "",
  job_title: "",
  email_guess: "",
  linkedin_url: "",
  company_size: "",
  pain_points: "",
  lead_score: "",
  score_reason: "",
  personalized_message: "",
};

const keywordWeights: Record<string, number> = {
  churn: 16,
  conversion: 14,
  retention: 12,
  automation: 10,
  manual: 8,
  outdated: 8,
  slow: 6,
  compliance: 14,
  security: 12,
  integration: 10,
  scaling: 10,
  growth: 8,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const guessEmail = (contactName: string, companyName: string) => {
  if (!contactName && !companyName) return "";
  const normalizedName = contactName.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const parts = normalizedName.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const normalizedCompany = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(inc|llc|ltd|corp|co)$/g, "")
    .trim();
  if (!first || !normalizedCompany) return "";

  const handle = last ? `${first}.${last}` : first;
  return `${handle}@${normalizedCompany || "example"}.com`;
};

const computeInsights = (form: LeadForm): LeadInsight => {
  let score = 25;
  const reasons: string[] = [];
  const missing: string[] = [];

  if (form.company_name) {
    score += 8;
    reasons.push(`Company identified as ${form.company_name}.`);
  } else {
    missing.push("Company Name");
  }

  if (form.contact_name) {
    score += 8;
    reasons.push(`Contact identified as ${form.contact_name}.`);
  } else {
    missing.push("Contact Name");
  }

  if (form.job_title) {
    score += 5;
    if (/founder|chief|vp|head|director/i.test(form.job_title)) {
      score += 10;
      reasons.push("Decision-maker level job title detected.");
    } else {
      reasons.push("Relevant job title provided.");
    }
  } else {
    missing.push("Job Title");
  }

  if (form.linkedin_url) {
    score += 6;
    reasons.push("LinkedIn profile supplied for deeper research.");
  } else {
    missing.push("LinkedIn URL");
  }

  if (form.company_size) {
    const numeric = parseInt(form.company_size.replace(/\D/g, ""), 10);
    if (!Number.isNaN(numeric)) {
      if (numeric >= 1000) score += 15;
      else if (numeric >= 300) score += 12;
      else if (numeric >= 50) score += 8;
      else score += 4;
      reasons.push(
        `Company size suggests ${
          numeric >= 300 ? "mid-market/enterprise" : "SMB"
        } potential.`
      );
    } else {
      score += 6;
      reasons.push("Company size provided qualitatively.");
    }
  } else {
    missing.push("Company Size");
  }

  if (form.pain_points) {
    const text = form.pain_points.toLowerCase();
    let keywordScore = 0;
    for (const [keyword, weight] of Object.entries(keywordWeights)) {
      if (text.includes(keyword)) {
        keywordScore += weight;
        reasons.push(`Mentions "${keyword}" as a pain point.`);
      }
    }
    score += keywordScore || 10;
    if (!keywordScore) {
      reasons.push("Pain points captured for personalization.");
    }
  } else {
    missing.push("Pain Points");
  }

  if (missing.length > 0) {
    score -= missing.length * 4;
  }

  const finalScore = clamp(Math.round(score), 1, 100);

  const summarizedReasons = [
    ...reasons,
    missing.length
      ? `Missing context for: ${missing.join(", ")}.`
      : "Key fields are complete for outreach.",
  ].join(" ");

  const messageParts: string[] = [];
  if (form.contact_name) {
    messageParts.push(`Hi ${form.contact_name.split(" ")[0]},`);
  } else {
    messageParts.push("Hi there,");
  }
  messageParts.push("");
  messageParts.push(
    form.company_name
      ? `I noticed ${form.company_name} is tackling ${
          form.pain_points || "some big initiatives"
        }`
      : `I came across your work${
          form.job_title ? ` as ${form.job_title}` : ""
        }`
  );
  if (form.pain_points) {
    messageParts.push(
      `Teams similar to yours solved challenges around ${form.pain_points
        .toLowerCase()
        .replace(/\.$/, "")} by streamlining their GTM workflows with our platform.`
    );
  }
  messageParts.push(
    "Would you be open to a 15-minute conversation next week to see if we can help accelerate your roadmap?"
  );
  messageParts.push("");
  messageParts.push("Best,");
  messageParts.push("Your Name");

  return {
    leadScore: finalScore,
    scoreReason: summarizedReasons,
    personalizedMessage: messageParts.join("\n"),
    missingFields: missing,
  };
};

const fields: {
  key: keyof LeadForm;
  label: string;
  textarea?: boolean;
  placeholder?: string;
}[] = [
  {
    key: "company_name",
    label: "Company Name",
    placeholder: "Example: Acme Robotics",
  },
  {
    key: "contact_name",
    label: "Contact Name",
    placeholder: "Example: Leslie Wong",
  },
  {
    key: "job_title",
    label: "Job Title",
    placeholder: "Example: VP of Operations",
  },
  {
    key: "linkedin_url",
    label: "LinkedIn URL",
    placeholder: "https://www.linkedin.com/in/lesliewong",
  },
  {
    key: "company_size",
    label: "Company Size",
    placeholder: "Example: 350",
  },
  {
    key: "pain_points",
    label: "Pain Points",
    textarea: true,
    placeholder: "Example: High churn due to manual onboarding...",
  },
];

export default function Home() {
  const [form, setForm] = useState<LeadForm>(initialForm);
  const [copiedField, setCopiedField] = useState<"" | "reason" | "message" | "email">("");

  const insight = useMemo(() => {
    const email =
      form.email_guess || guessEmail(form.contact_name, form.company_name);
    const computed = computeInsights({ ...form, email_guess: email });
    return { ...computed, email };
  }, [form]);

  const handleChange = (key: keyof LeadForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setCopiedField("");
  };

  const handleCopy = async (
    text: string,
    field: "reason" | "message" | "email"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 2500);
    } catch (error) {
      console.error("Clipboard copy failed", error);
    }
  };

  return (
    <div className={styles.wrapper}>
      <main className={styles.layout}>
        <section className={styles.formPanel}>
          <header className={styles.header}>
            <div>
              <h1>Lead Intelligence Builder</h1>
              <p>Create tailored outreach in seconds with automated scoring.</p>
            </div>
            <button
              type="button"
              className={styles.reset}
              onClick={() => setForm(initialForm)}
            >
              Reset
            </button>
          </header>
          <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
            {fields.map(({ key, label, textarea, placeholder }) => (
              <label key={key} className={styles.field}>
                <span>{label}</span>
                {textarea ? (
                  <textarea
                    value={form[key]}
                    onChange={(event) => handleChange(key, event.target.value)}
                    placeholder={placeholder}
                    rows={4}
                  />
                ) : (
                  <input
                    value={form[key]}
                    onChange={(event) => handleChange(key, event.target.value)}
                    placeholder={placeholder}
                  />
                )}
              </label>
            ))}
          </form>
          <div className={styles.generated}>
            <div className={styles.generatedHeader}>
              <h2>Automations</h2>
              <p>Fine-tune any generated field before sending.</p>
            </div>
            <label className={styles.field}>
              <span>Email Guess</span>
              <div className={styles.copyRow}>
                <input
                  value={form.email_guess || insight.email}
                  onChange={(event) => handleChange("email_guess", event.target.value)}
                  placeholder="firstname.lastname@company.com"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(form.email_guess || insight.email, "email")
                  }
                >
                  {copiedField === "email" ? "Copied" : "Copy"}
                </button>
              </div>
            </label>
            <label className={styles.field}>
              <span>Lead Score</span>
              <div className={styles.copyRow}>
                <input
                  value={form.lead_score || insight.leadScore.toString()}
                  onChange={(event) => handleChange("lead_score", event.target.value)}
                  placeholder="0-100"
                />
                <div className={styles.badge}>{insight.leadScore}</div>
              </div>
            </label>
            <label className={styles.field}>
              <span>Score Rationale</span>
              <div className={styles.copyRowWide}>
                <textarea
                  value={form.score_reason || insight.scoreReason}
                  onChange={(event) => handleChange("score_reason", event.target.value)}
                  rows={4}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(form.score_reason || insight.scoreReason, "reason")
                  }
                >
                  {copiedField === "reason" ? "Copied" : "Copy"}
                </button>
              </div>
            </label>
            <label className={styles.field}>
              <span>Personalized Message</span>
              <div className={styles.copyRowWide}>
                <textarea
                  value={form.personalized_message || insight.personalizedMessage}
                  onChange={(event) =>
                    handleChange("personalized_message", event.target.value)
                  }
                  rows={8}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      form.personalized_message || insight.personalizedMessage,
                      "message"
                    )
                  }
                >
                  {copiedField === "message" ? "Copied" : "Copy"}
                </button>
              </div>
            </label>
          </div>
        </section>
        <section className={styles.summaryPanel}>
          <div className={styles.scoreCard}>
            <span className={styles.scoreLabel}>Lead Score</span>
            <strong className={styles.scoreValue}>{insight.leadScore}</strong>
            <span className={styles.scoreTag}>
              {insight.leadScore >= 80
                ? "Hot"
                : insight.leadScore >= 60
                ? "Warm"
                : "Nurture"}
            </span>
          </div>
          <div className={styles.summaryBlock}>
            <h2>Quick Summary</h2>
            <div className={styles.summaryContent}>
              <dl>
                <div>
                  <dt>Company</dt>
                  <dd>{form.company_name || "—"}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{form.contact_name || "—"}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{form.job_title || "—"}</dd>
                </div>
                <div>
                  <dt>LinkedIn</dt>
                  <dd>
                    {form.linkedin_url ? (
                      <a href={form.linkedin_url} target="_blank" rel="noreferrer">
                        View Profile
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Company Size</dt>
                  <dd>{form.company_size || "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className={styles.summaryBlock}>
            <h2>Score Rationale</h2>
            <p>{form.score_reason || insight.scoreReason}</p>
          </div>
          <div className={styles.summaryBlock}>
            <h2>Personalized Message</h2>
            <pre>{form.personalized_message || insight.personalizedMessage}</pre>
          </div>
          {insight.missingFields.length > 0 && (
            <div className={styles.summaryBlock}>
              <h2>Next Inputs</h2>
              <ul>
                {insight.missingFields.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
