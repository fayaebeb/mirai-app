import { useState } from "react";
import { Message } from "@shared/schema";
import { exportChatToPDF } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import clsx from "clsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Define the form schema
const exportFormSchema = z.object({
  fileName: z.string().min(1, "ファイル名を入力してください"),
  title: z.string().optional(),
  includeTimestamp: z.boolean().default(true),
  theme: z.enum(["light", "dark"]).default("light"),
  quality: z.enum(["high", "medium", "low"]).default("medium"),
});

type ExportFormValues = z.infer<typeof exportFormSchema>;

export interface ChatPDFExportProps {
  messages: Message[];
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
}

  export function ChatPDFExport({
    messages,
    triggerContent,
    triggerClassName,
    }: ChatPDFExportProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Initialize the form
  const form = useForm<ExportFormValues>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      fileName: "chat-export",
      title: "チャットの会話",
      includeTimestamp: true,
      theme: "light",
      quality: "medium",
    },
  });

  // Handle form submission
  const onSubmit = async (values: ExportFormValues) => {
    if (messages.length === 0) {
      toast({
        title: "エクスポートできません",
        description: "エクスポートするメッセージがありません",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Map quality setting to numerical value for the PDF generator
      const qualityMap = {
        high: 1.5,   // Higher quality
        medium: 1.0, // Standard quality
        low: 0.7,    // Lower quality for smaller file size
      };

      const qualityValue = qualityMap[values.quality] || 1.0;

      await exportChatToPDF(messages, values.fileName, {
        title: values.title || "チャットの会話",
        includeTimestamp: values.includeTimestamp,
        theme: values.theme,
        quality: qualityValue,
      });

      toast({
        title: "エクスポートが完了しました",
        description: "PDFファイルが正常にダウンロードされました",
        variant: "default",
      });

      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "エラーが発生しました",
        description: "PDFのエクスポート中にエラーが発生しました",
        variant: "destructive",
      });
      console.error("PDF export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

      return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline" 
              size="sm" 
              className={clsx( 
                // your existing defaults 
               "text-noble-black-100 hover:text-noble-black-900 bg-black border border-noble-black-900 shadow-black shadow-2xl hover:bg-black flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full", 
                // **override** on mobile via the passed‐in prop 
                triggerClassName 
              )} 
            > 
              {triggerContent ?? ( 
                <> 
                  <FileText className="h-3.5 w-3.5" /> 
                  <span className="inline">PDFエクスポート</span> 
                </> 
              )} 
            </Button>
          </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] h-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle>PDFエクスポート</DialogTitle>
          <DialogDescription>
            会話をPDFとして保存します
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fileName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ファイル名</FormLabel>
                    <FormControl>
                      <Input placeholder="chat-export" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      PDFのファイル名
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>タイトル</FormLabel>
                    <FormControl>
                      <Input placeholder="チャットの会話" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      PDF内のタイトル
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>テーマ</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex space-x-4">
                          <FormItem className="flex items-center space-x-1 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="light" />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                              ライト
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-1 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="dark" />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                              ダーク
                            </FormLabel>
                          </FormItem>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeTimestamp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0 mt-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">タイムスタンプ表示</FormLabel>
                      <FormDescription className="text-xs">
                        メッセージの時間を表示
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="quality"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>画質設定</FormLabel>
                  <FormDescription className="text-xs mb-1">
                    ファイルサイズと画質のバランス
                  </FormDescription>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-6" 
                      // ↑ Horizontal layout. Adjust spacing as needed
                    >
                      {/* 高画質 */}
                      <FormItem className="flex flex-col items-start space-y-1">
                        <div className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="high" />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">
                            高画質
                          </FormLabel>
                        </div>
                        <FormDescription className="text-xs text-slate-500">
                          大きいサイズ
                        </FormDescription>
                      </FormItem>

                      {/* 標準 */}
                      <FormItem className="flex flex-col items-start space-y-1">
                        <div className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="medium" />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">
                            標準
                          </FormLabel>
                        </div>
                        <FormDescription className="text-xs text-slate-500">
                          推奨
                        </FormDescription>
                      </FormItem>

                      {/* 低画質 */}
                      <FormItem className="flex flex-col items-start space-y-1">
                        <div className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="low" />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">
                            低画質
                          </FormLabel>
                        </div>
                        <FormDescription className="text-xs text-slate-500">
                          小さいサイズ
                        </FormDescription>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />


            <DialogFooter className="mt-6 flex justify-between sm:justify-end gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  // mobile: h-12 (3rem); desktop and up: h-8 (2rem)
                  className="flex-1 sm:flex-none h-12 sm:h-8"
                >
                  キャンセル
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isExporting}
                // same height override
                className="flex items-center gap-1 flex-1 sm:flex-none h-12 sm:h-8"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    エクスポート
                  </>
                )}
              </Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}