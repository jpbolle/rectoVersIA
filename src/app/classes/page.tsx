'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ClasseCard from '@/components/ClasseCard/ClasseCard';
import CreateClasseCard from '@/components/CreateClasseCard/CreateClasseCard';
import ClasseCreationForm from '@/components/ClasseCreationForm/ClasseCreationForm';
import ClasseDetailForm from '@/components/ClasseDetailForm/ClasseDetailForm';
import AddClasseModal from '@/components/AddClasseModal/AddClasseModal';
import AddEleveModal from '@/components/AddEleveModal/AddEleveModal';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { Classe, Eleve } from '@/types/classe';
import styles from './classes.module.css';

export default function ClassesPage() {
  const { isAuthenticated, isLoading: authLoading, role, user } = useAuth();
  const router = useRouter();
  const {
    classes,
    isLoading: classesLoading,
    createClasse,
    updateClasse,
    deleteClasse,
    toggleArchive,
    refetch: refetchClasses,
  } = useClasses();

  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // État du formulaire de création
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État du détail de classe
  const [selectedClasse, setSelectedClasse] = useState<Classe | null>(null);

  // Modale édition classe
  const [isClasseModalOpen, setIsClasseModalOpen] = useState(false);
  const [editingClasse, setEditingClasse] = useState<Classe | null>(null);
  const [isSavingClasse, setIsSavingClasse] = useState(false);

  // Modale élève
  const [isEleveModalOpen, setIsEleveModalOpen] = useState(false);
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null);
  const [selectedClasseId, setSelectedClasseId] = useState<string | null>(null);
  const [isSavingEleve, setIsSavingEleve] = useState(false);

  // Onglet actif: actives ou archives
  const [activeTab, setActiveTab] = useState<'actives' | 'archives'>('actives');

  // Filtrer les classes selon l'onglet
  const filteredClasses = classes.filter((c) =>
    activeTab === 'actives' ? !c.archive : c.archive
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (role !== 'prof') {
      router.replace('/activites');
    }
  }, [isAuthenticated, authLoading, role, router]);

  // Handlers pour les classes
  const handleAddClasse = () => {
    setSelectedClasse(null); // Fermer le détail si ouvert
    setIsFormVisible(true);
  };

  const handleClasseClick = (classe: Classe) => {
    setIsFormVisible(false); // Fermer le formulaire de création si ouvert
    setSelectedClasse(classe);
  };

  const handleEditClasse = (classe: Classe) => {
    setEditingClasse(classe);
    setIsClasseModalOpen(true);
  };

  const handleSubmitEditClasse = async (data: { nom: string; description?: string }) => {
    if (!editingClasse) return;

    setIsSavingClasse(true);
    try {
      await updateClasse(editingClasse.id, data);
      setMessage({ text: 'Classe modifiée', type: 'success' });
      setIsClasseModalOpen(false);
      setEditingClasse(null);
      // Mettre à jour le détail si ouvert
      if (selectedClasse?.id === editingClasse.id) {
        setSelectedClasse({ ...selectedClasse, ...data });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la modification',
        type: 'error',
      });
    } finally {
      setIsSavingClasse(false);
    }
  };

  const handleDeleteClasse = async (classe: Classe) => {
    if (!confirm(`Supprimer la classe "${classe.nom}" et tous ses élèves ?`)) return;

    try {
      await deleteClasse(classe.id);
      setMessage({ text: 'Classe supprimée', type: 'success' });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la suppression',
        type: 'error',
      });
    }
  };

  const handleSubmitClasse = async (data: { nom: string; description?: string }) => {
    setIsSubmitting(true);
    try {
      await createClasse(data);
      setMessage({ text: 'Classe créée', type: 'success' });
      setIsFormVisible(false);
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la création',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportSuccess = useCallback(
    async (classeId: string, studentsCount: number) => {
      // Rafraîchir la liste des classes
      await refetchClasses();
      setMessage({
        text: `Classe importée avec ${studentsCount} élève(s)`,
        type: 'success',
      });
      setIsFormVisible(false);
    },
    [refetchClasses]
  );

  // Handlers pour les élèves
  const handleAddEleve = (classeId: string) => {
    setSelectedClasseId(classeId);
    setEditingEleve(null);
    setIsEleveModalOpen(true);
  };

  const handleEditEleve = (eleve: Eleve) => {
    setSelectedClasseId(eleve.classeId);
    setEditingEleve(eleve);
    setIsEleveModalOpen(true);
  };

  const handleDeleteEleve = async (eleve: Eleve) => {
    if (!confirm(`Supprimer l'élève "${eleve.prenom} ${eleve.nom}" ?`)) return;

    try {
      const res = await fetch(`/api/eleves/${eleve.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
      });

      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Élève supprimé', type: 'success' });
        // Rafraîchir la liste si le détail est ouvert
        if (selectedClasse?.id === eleve.classeId) {
          setSelectedClasse({ ...selectedClasse });
        }
      } else {
        throw new Error(json.message);
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la suppression',
        type: 'error',
      });
    }
  };

  const handleSubmitEleve = async (data: { nom: string; prenom: string; email: string }) => {
    setIsSavingEleve(true);
    try {
      const method = editingEleve ? 'PATCH' : 'POST';
      const url = editingEleve ? `/api/eleves/${editingEleve.id}` : '/api/eleves';
      const body = editingEleve
        ? data
        : { ...data, classeId: selectedClasseId };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success) {
        setMessage({
          text: editingEleve ? 'Élève modifié' : 'Élève ajouté',
          type: 'success',
        });
        setIsEleveModalOpen(false);
        setEditingEleve(null);
        // Rafraîchir la liste si le détail est ouvert
        if (selectedClasse?.id === selectedClasseId) {
          setSelectedClasse({ ...selectedClasse });
        }
      } else {
        throw new Error(json.message);
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement',
        type: 'error',
      });
    } finally {
      setIsSavingEleve(false);
    }
  };

  const handleToggleArchive = useCallback(
    async (id: string, archive: boolean) => {
      try {
        await toggleArchive(id, archive);
        if (archive) {
          setMessage({ text: 'Classe archivée', type: 'success' });
        }
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de l\'archivage',
          type: 'error',
        });
      }
    },
    [toggleArchive]
  );

  if (authLoading) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />

      <main className={styles.mainContent}>
        <MessageBox
          message={message?.text || null}
          type={message?.type || 'success'}
          onDismiss={() => setMessage(null)}
        />

        <section className={styles.classesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Mes Classes</h2>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'actives' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('actives')}
              >
                Classes actives
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'archives' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('archives')}
              >
                Classes archivées
              </button>
            </div>
          </div>

          <div className={styles.classesGrid}>
            {classesLoading ? (
              <EmptyState icon="hourglass" message="Chargement..." />
            ) : filteredClasses.length === 0 ? (
              <>
                <CreateClasseCard onClick={handleAddClasse} />
              </>
            ) : (
              <>
                {filteredClasses.map((classe) => (
                  <ClasseCard
                    key={classe.id}
                    classe={classe}
                    onEdit={handleEditClasse}
                    onDelete={handleDeleteClasse}
                    onToggleArchive={handleToggleArchive}
                    onClick={() => handleClasseClick(classe)}
                  />
                ))}
                <CreateClasseCard onClick={handleAddClasse} />
              </>
            )}
          </div>
        </section>

        {isFormVisible && (
          <section className={styles.creationSection}>
            <ClasseCreationForm
              isVisible={isFormVisible}
              onSubmit={handleSubmitClasse}
              isSubmitting={isSubmitting}
              onClose={() => setIsFormVisible(false)}
              onImportSuccess={handleImportSuccess}
            />
          </section>
        )}

        {selectedClasse && (
          <section className={styles.detailSection}>
            <ClasseDetailForm
              classe={selectedClasse}
              isVisible={!!selectedClasse}
              onClose={() => setSelectedClasse(null)}
              onAddEleve={handleAddEleve}
              onEditEleve={handleEditEleve}
              onDeleteEleve={handleDeleteEleve}
            />
          </section>
        )}
      </main>

      <Footer />

      <AddClasseModal
        isOpen={isClasseModalOpen}
        onClose={() => {
          setIsClasseModalOpen(false);
          setEditingClasse(null);
        }}
        onSubmit={handleSubmitEditClasse}
        editingClasse={editingClasse}
        isSaving={isSavingClasse}
      />

      <AddEleveModal
        isOpen={isEleveModalOpen}
        onClose={() => {
          setIsEleveModalOpen(false);
          setEditingEleve(null);
        }}
        onSubmit={handleSubmitEleve}
        editingEleve={editingEleve}
        isSaving={isSavingEleve}
        classeName={classes.find((c) => c.id === selectedClasseId)?.nom}
      />
    </div>
  );
}
