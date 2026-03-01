export interface MessageLink {
  text: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  links?: MessageLink[];
  isAdminReply?: boolean;
}

export interface ChatWidgetProps {
  /** Author identifier for API calls */
  authorSlug: string;

  /** API base URL (defaults to production) */
  apiBaseUrl?: string;

  /** Avatar image URL */
  avatarUrl?: string;

  /** Author/assistant name */
  authorName?: string;

  /** Position of the widget */
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };

  /** Offset for the bubble button (to avoid overlapping with other buttons) */
  bubbleOffset?: {
    right?: number;
    left?: number;
  };

  /** Theme customization */
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    userMessageBg?: string;
    assistantMessageBg?: string;
  };

  /** Welcome message shown when chat opens */
  welcomeMessage?: string;

  /** Input placeholder text */
  placeholder?: string;

  /** Path to expand to full page chat (e.g., '/chat') */
  expandPath?: string;

  /** z-index for the widget */
  zIndex?: number;
}

export interface ChatState {
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
