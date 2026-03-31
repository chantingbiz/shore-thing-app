import { Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../data/technicians.js";
import SubpageTemplate from "./SubpageTemplate.jsx";

export default function TechnicianDetailPage() {
  const { slug } = useParams();
  const technician = getTechnicianBySlug(slug);

  if (!technician) {
    return <Navigate to="/technicians" replace />;
  }

  return (
    <SubpageTemplate title={technician.name} backTo="/technicians" />
  );
}
