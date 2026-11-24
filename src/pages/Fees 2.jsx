import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader } from "../components/ui";

export default function Fees() {
  const fees = useQuery({ queryKey: ["fees"], queryFn: () => api.get("/fees").then(r => r.data) });
  const total = fees.data?.reduce((a, b) => a + b.amount, 0) || 0;
  const paid = fees.data?.filter(f => f.status === "paid").reduce((a, b) => a + b.amount, 0) || 0;

  return (
    <div>
      <PageHeader title="Fees" subtitle={`Collected ₹${paid.toLocaleString("en-IN")} of ₹${total.toLocaleString("en-IN")}`} />
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="th">Student</th><th className="th">Title</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Due</th>
          </tr></thead>
          <tbody>
            {fees.data?.map(f => (
              <tr key={f._id} className="border-t border-gray-100">
                <td className="td">{f.student?.user?.name}</td>
                <td className="td">{f.title}</td>
                <td className="td">₹{Number(f.amount || 0).toLocaleString("en-IN")}</td>
                <td className="td">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    f.status === "paid" ? "bg-green-100 text-green-700" :
                    f.status === "partial" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>{f.status}</span>
                </td>
                <td className="td">{f.dueDate?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}