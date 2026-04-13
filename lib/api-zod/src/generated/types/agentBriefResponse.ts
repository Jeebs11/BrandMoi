/**
 * Agent brief response including AI-generated angle ideas and teach angles
 */
export interface AgentBriefResponse {
  headline: string;
  insight: string;
  angles: string[];
  teachAngles: string[];
  newsHeadline?: string;
  newsSourceLine?: string;
  newsUrl?: string;
  newsPublishedAt?: string;
  newsSourceDomain?: string;
  newsDescription?: string;
}
