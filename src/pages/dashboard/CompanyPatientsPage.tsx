"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Users,
  Eye,
  EyeOff,
  Calendar,
  HeartPulse,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import CompanyPatientForm from "@/components/CompanyPatientForm";
import AccessRestricted from "@/components/AccessRestricted";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Patient {
  id: string;
  patient_name?: string; // Changed to optional
  patient_age?: number;
  patient_medical_conditions?: string;
  patient_mobility_level?: string[];
  patient_cognitive_state?: string[];
  patient_special_equipment?: string[];
  patient_communication_skills?: string[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

const CompanyPatientsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setUserRole(data?.role || null);
      }
    };
    fetchUserRole();
  }, [user]);

  useEffect(() => {
    if (user && userRole === 'company') {
      fetchPatients();
    } else if (!authLoading && userRole !== 'company') {
      setLoading(false); // Stop loading if not a company user
    }
  }, [user, userRole, authLoading]);

  const fetchPatients = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("company_patients")
        .select("*")
        .eq("company_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (err: any) {
      console.error("[CompanyPatientsPage] Erro ao carregar pacientes:", err);
      toast.error("Erro ao carregar pacientes. Tente sincronizar o banco de dados nas configurações.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAddPatient = () => {
    setSelectedPatient(null);
    setIsModalOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  };

  const handleDeleteConfirmation = (patient: Patient) => {
    setPatientToDelete(patient);
    setIsDeleteDialogOpen(true);
  };

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("company_patients")
        .delete()
        .eq("id", patientToDelete.id);

      if (error) throw error;
      toast.success("Paciente excluído com sucesso!");
      fetchPatients(true);
      setIsDeleteDialogOpen(false);
      setPatientToDelete(null);
    } catch (err) {
      console.error("[CompanyPatientsPage] Erro ao excluir paciente:", err);
      toast.error("Erro ao excluir paciente.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== 'company') {
    return (
      <AccessRestricted
        description="Esta funcionalidade é exclusiva para perfis de Empresas de Home Care."
        primaryAction={{ label: "Ir para Meu Painel", to: "/dashboard" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Meus Pacientes
          </h1>
          <p className="text-muted-foreground">Gerencie os pacientes que sua empresa atende.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fetchPatients(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar Lista
          </Button>
          <Button className="gap-2" onClick={handleAddPatient}>
            <Plus className="h-4 w-4" /> Novo Paciente
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {patients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID/Código do Paciente</TableHead> {/* Updated TableHead */}
                  <TableHead>Idade</TableHead>
                  <TableHead>Condições Médicas</TableHead>
                  <TableHead>Visibilidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.patient_name || 'N/A'}</TableCell> {/* Display N/A if empty */}
                    <TableCell>{patient.patient_age || 'N/A'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {patient.patient_medical_conditions || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {patient.is_visible ? (
                        <Badge className="bg-success/10 text-success border-success/20 gap-1">
                          <Eye className="h-3 w-3" /> Visível
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="h-3 w-3" /> Oculto
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditPatient(patient)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteConfirmation(patient)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum paciente cadastrado ainda.</p>
              <Button variant="outline" className="mt-4" onClick={handleAddPatient}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Primeiro Paciente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-card">
            <DialogTitle>{selectedPatient ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
            <DialogDescription>
              Preencha os detalhes do paciente para que os profissionais possam entender as necessidades.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <CompanyPatientForm
              initialData={selectedPatient}
              onSuccess={() => {
                setIsModalOpen(false);
                fetchPatients(true);
              }}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Paciente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir o paciente <strong>"{patientToDelete?.patient_name || 'selecionado'}"</strong>?
              Esta ação é irreversível e removerá todos os dados deste paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDeletePatient();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyPatientsPage;