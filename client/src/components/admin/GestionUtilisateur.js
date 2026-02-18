import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaTrash,
  FaUserShield,
  FaEdit,
  FaCheck,
  FaTimes,
  FaKey
} from "react-icons/fa";
import "../style/gestionUtilisateur.css";

const GestionUtilisateur = () => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ name: "", email: "", phone: "" });

  const [editingId, setEditingId] = useState(null);
  const [pwdId, setPwdId] = useState(null);

  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [newPassword, setNewPassword] = useState("");

  // ================= FETCH USERS =================
  const fetchUsers = async () => {
    const query = new URLSearchParams(filters).toString();

    const res = await axios.get(
      `http://localhost:5000/api/admin/users?${query}`,
      { withCredentials: true }
    );

    setUsers(res.data || []);
  };

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  // ================= ROLE =================
  const handleRoleChange = async (id, role) => {
    await axios.put(
      `http://localhost:5000/api/admin/users/${id}/role`,
      { role },
      { withCredentials: true }
    );
    fetchUsers();
  };

  // ================= STATUS =================
  const toggleStatus = async (id, currentStatut) => {
    await axios.put(
      `http://localhost:5000/api/admin/users/${id}/status`,
      { statut: !currentStatut },
      { withCredentials: true }
    );
    fetchUsers();
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;

    await axios.delete(
      `http://localhost:5000/api/admin/users/${id}`,
      { withCredentials: true }
    );

    fetchUsers();
  };

  // ================= EDIT INFO =================
  const startEdit = (user) => {
    setPwdId(null);
    setEditingId(user.id);
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      address: user.address || ""
    });
  };

  const saveEdit = async (id) => {
    await axios.put(
      `http://localhost:5000/api/admin/users/${id}`,
      form,
      { withCredentials: true }
    );

    setEditingId(null);
    fetchUsers();
  };

  // ================= PASSWORD =================
  const startPassword = (user) => {
    setEditingId(null);
    setPwdId(user.id);
    setNewPassword("");
  };

  const savePassword = async (id) => {
    if (!newPassword || newPassword.length < 8) {
      alert("Mot de passe min 8 caractères");
      return;
    }

    await axios.put(
      `http://localhost:5000/api/admin/users/${id}/password`,
      { newPassword },
      { withCredentials: true }
    );

    alert("Mot de passe modifié ✅");
    setPwdId(null);
    setNewPassword("");
  };

  return (
    <div className="page">
      <div className="full-width-container">

        <div className="page-header">
          <div className="page-header-title">
            <FaUserShield />
            <h2>Gestion des utilisateurs</h2>
          </div>
        </div>

        {/* FILTERS */}
        <div className="filters-card">
          <div className="filters-grid-pro">
            <input
              className="input"
              placeholder="Nom"
              value={filters.name}
              onChange={(e) =>
                setFilters({ ...filters, name: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Email"
              value={filters.email}
              onChange={(e) =>
                setFilters({ ...filters, email: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Téléphone"
              value={filters.phone}
              onChange={(e) =>
                setFilters({ ...filters, phone: e.target.value })
              }
            />
          </div>
        </div>

        {/* LIST */}
        <div className="transactions-container">
          <div className="transactions-list">

            {users.map((user) => (
              <div
                key={user.id}
                className={`transaction-row ${
                  user.role === "ADMIN" ? "blue" : "green"
                }`}
              >
                <div className="transaction-left">

                  {editingId === user.id ? (
                    <>
                      <input
                        className="input"
                        value={form.name}
                        placeholder="Nom"
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                      <input
                        className="input"
                        value={form.phone}
                        placeholder="Téléphone"
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                      />
                      <input
                        className="input"
                        value={form.address}
                        placeholder="Adresse"
                        onChange={(e) =>
                          setForm({ ...form, address: e.target.value })
                        }
                      />
                    </>
                  ) : pwdId === user.id ? (
                    <input
                      type="password"
                      className="input"
                      placeholder="Nouveau mot de passe"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  ) : (
                    <>
                      <div className="transaction-number">{user.name}</div>
                      <div className="transaction-meta">{user.email}</div>
                      <div className="transaction-meta">{user.phone || "—"}</div>
                      <div className="transaction-status">
                        Rôle : {user.role}
                      </div>
                      <div className="transaction-status">
                        Statut : {user.statut ? "Actif" : "Désactivé"}
                      </div>
                    </>
                  )}
                </div>

                <div className="transaction-actions">

                  {editingId === user.id ? (
                    <>
                      <button className="btn btn-primary btn-icon" onClick={() => saveEdit(user.id)}>
                        <FaCheck />
                      </button>
                      <button className="btn btn-outline btn-icon" onClick={() => setEditingId(null)}>
                        <FaTimes />
                      </button>
                    </>
                  ) : pwdId === user.id ? (
                    <>
                      <button className="btn btn-primary btn-icon" onClick={() => savePassword(user.id)}>
                        <FaCheck />
                      </button>
                      <button className="btn btn-outline btn-icon" onClick={() => setPwdId(null)}>
                        <FaTimes />
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        className="role-select"
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>

                      <button
                        type="button"
                        className={`switch ${user.statut ? "on" : "off"}`}
                        onClick={() =>
                          toggleStatus(user.id, user.statut)
                        }
                      >
                        <span className="switch-knob" />
                      </button>

                      <button
                        className="btn btn-outline btn-icon"
                        onClick={() => startPassword(user)}
                      >
                        <FaKey />
                      </button>

                      <button
                        className="btn btn-outline btn-icon"
                        onClick={() => startEdit(user)}
                      >
                        <FaEdit />
                      </button>

                      <button
                        className="btn btn-outline btn-icon"
                        onClick={() => handleDelete(user.id)}
                      >
                        <FaTrash />
                      </button>
                    </>
                  )}

                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionUtilisateur;
