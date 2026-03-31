/**
 * Legacy local types kept as a compatibility/reference layer while the app
 * standardizes on `@opencanvas/shared/types`.
 *
 * Current `apps/web` code does not import this file, but we keep the
 * markdown-oriented interfaces to avoid losing useful migration context.
 */

export type Message = {
  id: string;
  text?: string;
  rawResponse?: Record<string, any>;
  sender: string;
  toolCalls?: ToolCall[];
};

export interface ToolCall {
  id: string;
  name: string;
  args: string;
  result?: any;
}

export type Model = "gpt-4o-mini" | string;

export type UserRules = {
  styleRules: string[];
  contentRules: string[];
};

export interface ArtifactV2 {
  id: string;
  contents: ArtifactMarkdownContent[];
  currentContentIndex: number;
}

export interface MarkdownBlock {
  id: string;
  content: Array<{
    id: string;
    type: string;
    text: string;
    styles: Record<string, any>;
  }>;
  type: string;
}

export interface ArtifactMarkdownContent {
  index: number;
  blocks: MarkdownBlock[];
  title: string;
  type: "text";
}

export interface Highlight {
  /**
   * The index of the first character of the highlighted text
   */
  startCharIndex: number;
  /**
   * The index of the last character of the highlighted text
   */
  endCharIndex: number;
}

export interface NewMarkdownToolResponse {
  blocks: Array<{ block_id?: string; new_text?: string }>;
}

export interface ModelConfig {
  temperature?: number;
  modelProvider: string;
  maxTokens?: number;
  azureConfig?: {
    azureOpenAIApiKey: string;
    azureOpenAIApiInstanceName: string;
    azureOpenAIApiDeploymentName: string;
    azureOpenAIApiVersion: string;
    azureOpenAIBasePath?: string;
  };
}
