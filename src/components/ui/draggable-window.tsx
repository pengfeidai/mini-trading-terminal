"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableWindowProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  hideHeader?: boolean;
}

export function DraggableWindow({
  open,
  onClose,
  children,
  title,
  className,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 300 },
  minWidth = 300,
  minHeight = 200,
  maxWidth,
  maxHeight,
  hideHeader = false,
}: DraggableWindowProps) {
  const [position, setPosition] = React.useState(defaultPosition);
  const [size, setSize] = React.useState(defaultSize);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = React.useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const windowRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const resizeHandleRef = React.useRef<HTMLDivElement>(null);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!windowRef.current) return;

    const rect = windowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  // Handle drag
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep window within viewport
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - 100; // Leave some space at bottom

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, size.width, size.height]);

  // Handle resize
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!windowRef.current) return;

      const rect = windowRef.current.getBoundingClientRect();
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height,
      });
      setIsResizing(true);
    },
    []
  );

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = resizeStart.width + deltaX;
      let newHeight = resizeStart.height + deltaY;

      // Apply constraints
      if (minWidth) newWidth = Math.max(newWidth, minWidth);
      if (minHeight) newHeight = Math.max(newHeight, minHeight);
      if (maxWidth) newWidth = Math.min(newWidth, maxWidth);
      if (maxHeight) newHeight = Math.min(newHeight, maxHeight);

      // Keep within viewport
      const maxW = window.innerWidth - position.x;
      const maxH = window.innerHeight - position.y;
      newWidth = Math.min(newWidth, maxW);
      newHeight = Math.min(newHeight, maxH);

      setSize({
        width: newWidth,
        height: newHeight,
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isResizing,
    resizeStart,
    position,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  ]);

  if (!open) return null;

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed z-50 rounded-2xl border bg-background shadow-lg",
        "select-none transition-opacity duration-200",
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        pointerEvents: "auto",
        opacity: isDragging || isResizing ? 0.7 : 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with drag handle - only show if title exists and hideHeader is false */}
      {!hideHeader && title && (
        <div
          ref={headerRef}
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between border-b px-5 py-3 cursor-move rounded-t-2xl flex-shrink-0"
        >
          <div className="font-semibold text-sm">{title}</div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            style={{ pointerEvents: "auto" }}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      )}
      
      {/* Minimal drag handle when header is hidden */}
      {(hideHeader || !title) && (
        <div
          ref={headerRef}
          onMouseDown={handleMouseDown}
          className="flex justify-center py-2 cursor-move"
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
      )}

      {/* Content */}
      <div
        className="p-5 overflow-auto flex-1"
        style={{
          pointerEvents: "auto",
        }}
      >
        {children}
      </div>

      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 0%, transparent 40%, hsl(var(--border)) 40%, hsl(var(--border)) 50%, transparent 50%, transparent 60%, hsl(var(--border)) 60%, hsl(var(--border)) 100%)",
        }}
      />
    </div>
  );
}
