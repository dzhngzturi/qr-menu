import { toast } from "react-hot-toast";

export const notify = {
  success: (m: string) => toast.success(m),
  error:   (m: string) => toast.error(m),
  info:    (m: string) => toast(m),
  promise: <T>(p: Promise<T>, texts: {loading: string; success: string; error: string}) =>
    toast.promise(p, texts),
};
