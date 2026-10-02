"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/** GLB 로드 실패(404, 손상 파일 등) 시 앱 전체가 죽지 않도록 폴백을 보여준다. */
export default class AvatarBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[Avatar] model load failed, falling back to cube:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
