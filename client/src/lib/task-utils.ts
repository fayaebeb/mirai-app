// Define types here instead of importing from shared/schema to avoid import issues
export interface Goal {
    id: number;
    userId: number;
    title: string;
    description?: string | null;
    completed: boolean;
    dueDate?: Date | null;
    priority?: "high" | "medium" | "low" | null;
    category?: string | null;
    tags?: string[] | null;
    reminderTime?: Date | null;
    isRecurring?: boolean | null;
    recurringType?: "daily" | "weekly" | "monthly" | "custom" | null;
    recurringInterval?: number | null;
    recurringEndDate?: Date | null;
  }
  
  // Define category utility functions 
  export const defaultCategories = [
    { id: "work", name: "仕事", color: "bg-blue-500" },
    { id: "personal", name: "個人", color: "bg-green-500" },
    { id: "health", name: "健康", color: "bg-red-500" },
    { id: "education", name: "学習", color: "bg-purple-500" },
    { id: "finance", name: "財務", color: "bg-yellow-500" },
    { id: "social", name: "交流", color: "bg-pink-500" },
    { id: "home", name: "家庭", color: "bg-indigo-500" },
    { id: "other", name: "その他", color: "bg-gray-500" },
  ];
  
  export function getCategoryColor(categoryId: string | undefined | null): string {
    if (!categoryId) return "bg-gray-500";
    const category = defaultCategories.find(c => c.id === categoryId);
    return category ? category.color : "bg-gray-500";
  }
  
  export function getCategoryName(categoryId: string | undefined | null): string {
    if (!categoryId) return "未分類";
    const category = defaultCategories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  }